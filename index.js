const express = require("express")
const { createServer } = require("http")
const io = require("./socket-server")
const cors = require("cors")
const path = require("path")

const app = express()
const port = process.env.PORT || 8000
const httpServer = createServer(app)

app.get("/test", (req, res) => res.json({ message: "It is a testing api" }))

io(httpServer)


app.use(cors({
  origin:'*'
}))
app.use(express.json())


// if (process.env.NODE_ENV == "production") {
app.use(express.static(path.resolve(__dirname, "./client/build")));
app.get("*", function (request, response) {
  response.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});
// }


httpServer.listen(port, () => console.log(`Server is running in port http://localhost:8000`))