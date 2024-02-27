const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "altynbeeeeek", resave: false, saveUninitialized: true }));
app.set("view engine", "ejs");

mongoose.connect("mongodb+srv://test:123@altynbek.2yqbc2y.mongodb.net/backend-final").then(() => {
    console.log("Connected to MongoDB");
});

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: String,
    hashed_password: String,
    created_at: { type: Date, default: Date.now },
    is_admin: { type: Boolean, default: false },
});

const User = mongoose.model("User", userSchema);

const dotaHeroSchema = new mongoose.Schema({
    name: String,
    name_ru: String,
    description: String,
    description_ru: String,
    type: String,
    type_ru: String,
    images: [String],
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    deleted_at: Date,
});

const DotaHero = mongoose.model("DotaHero", dotaHeroSchema);

User.findOneAndUpdate({ username: "altynbek" }, { is_admin: true }).then((user) => {
    console.log(user);
});

app.get("/", async (req, res) => {
    const user = await User.findById(req.session?.userId);
    const heroes = await DotaHero.find({ deleted_at: null });
    const language = req.query.lang;
    res.render("index", { user, isAdmin: user?.is_admin ?? false, heroes, language: language ?? "en" });
});

app.get("/news", async (req, res) => {
    const language = req.query.language;
    const user = await User.findById(req.session?.userId);
    const news = await getDotaNews(language ?? "en");
    res.render("news", { user, isAdmin: user?.is_admin ?? false, news, language: language ?? "en" });
});

app.get("/login", ensureNotAuthenticated, async (req, res) => {
    res.render("login", { user: null, isAdmin: false, error: null, success: false });
});

app.post("/login", ensureNotAuthenticated, async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username });

    if (user && (await bcrypt.compare(password, user.hashed_password))) {
        req.session.userId = user._id;
        return res.redirect("/");
    } else {
        return res.render("login", { error: "Invalid username or password", user: null, isAdmin: false, success: false });
    }
});

app.get("/signup", ensureNotAuthenticated, async (req, res) => {
    res.render("signup", { user: null, isAdmin: false, error: null });
});

app.post("/signup", ensureNotAuthenticated, async (req, res) => {
    const { name, username, email, password, s_password } = req.body;
    const hashed_password = await bcrypt.hash(password, 10);

    if (password !== s_password) {
        return res.render("signup", { error: "Passwords do not match", user: null, isAdmin: false });
    }

    const userExists = await User.findOne({ username: username });

    if (userExists) {
        return res.render("signup", { error: "User already exists", user: null, isAdmin: false });
    }

    const user = new User({ name, username, email, hashed_password });
    await user.save();

    res.render("login", { user: null, isAdmin: false, error: null, success: true });
});

app.get("/logout", ensureAuthenticated, async (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.post("/admin/heroes", ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, name_ru, description, description_ru, type, type_ru, images } = req.body;
    console.log(req.body);
    const imageLinks = images.split(",").map((link) => link.trim());

    const hero = new DotaHero({ name, name_ru, description, description_ru, type, type_ru, images: imageLinks });
    await hero.save();
    return res.redirect("/admin");
});

app.get("/admin", ensureAuthenticated, ensureAdmin, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const users = await User.find();
    const heroes = await DotaHero.find();
    res.render("admin", { user, isAdmin: user?.is_admin ?? false, heroes, users });
});

app.get("/admin/users/delete/:id", ensureAuthenticated, ensureAdmin, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
});

app.get("/admin/heroes/delete/:id", ensureAuthenticated, ensureAdmin, async (req, res) => {
    await DotaHero.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
});

app.get("/admin/heroes/edit/:id", ensureAuthenticated, ensureAdmin, async (req, res) => {
    const hero = await DotaHero.findById(req.params.id);
    const user = await User.findById(req.session.userId);
    res.render("edit", { user, hero, isAdmin: user?.is_admin ?? false });
});

app.post("/admin/heroes/edit/:id", ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, name_ru, description, description_ru, type, type_ru, images } = req.body;
    const imageLinks = images.split(",").map((link) => link.trim());

    await DotaHero.findByIdAndUpdate(req.params.id, {
        name,
        name_ru,
        description,
        description_ru,
        type,
        type_ru,
        images: imageLinks,
        updated_at: new Date(),
    });

    res.redirect("/admin");
});

app.get("/teams", async (req, res) => {
    const user = await User.findById(req.session?.userId);
    const teams = await getDotaTeams();
    res.render("teams", { user, isAdmin: user?.is_admin ?? false, teams });
});

app.listen(5000, "0.0.0.0", () => {
    console.log("Server is running on port :5000");
});

// api

async function getDotaNews(language) {
    const apikey = "7f6ff4477d12416996ffa6b12f7e165b";
    const link = `https://newsapi.org/v2/everything?q=dota%202&apiKey=${apikey}&page=1&pageSize=8&language=${language}`;

    const response = await fetch(link);
    const data = await response.json();
    console.log(data);
    return data.articles;
}

async function getDotaTeams() {
    const link = "https://api.opendota.com/api/teams";

    const response = await fetch(link);
    const data = await response.json();
    return data;
}

// middlewares

async function ensureAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect("/login");
    }
}

async function ensureAdmin(req, res, next) {
    const user = await User.findById(req.session.userId);
    if (user?.is_admin) {
        next();
    } else {
        res.redirect("/");
    }
}

async function ensureNotAuthenticated(req, res, next) {
    if (req.session.userId) {
        res.redirect("/");
    } else {
        next();
    }
}
