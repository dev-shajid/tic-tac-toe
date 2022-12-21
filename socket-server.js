const { Server } = require("socket.io")
const { v4 } = require("uuid")

function socket_server(server) {
    const io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV == 'production' ? "/" : "http://127.0.0.1:5173"
            // origin: "/"
        }
    })

    let users = []

    let addUser = (id, name, socketId) => {
        users.push({ id, name, socketId, roomId: null, win: null })
    }

    let getUser = (id) => {
        return users.find(user => user.id == id)
    }

    let updateUserRoom = (id, roomId) => {
        let user = getUser(id)
        user.roomId = roomId
    }

    let removeUser = (socketId) => {
        users = users.filter(user => user.socketId != socketId)
    }

    let move = {
        player1: [],
        player2: []
    }
    let cells = ['', '', '', '', '', '', '', '', '',]

    const winningCombination = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ]

    function checkWinner(moves, player) {
        let win = null
        winningCombination.forEach(comb => {
            let l = comb?.filter(e => {
                return moves.find(a => a == e)
            }).length
            if (comb.some(e => e == 0) && moves.some(a => a == 0)) l++
            if (l == 3) {
                win = player
                handleReset()
            }
        })
        if (move.player1.length + move.player2.length == 9 && !win) {
            win = -1
            handleReset()
        }
        return win

    }

    function handleReset() {
        move = {
            player1: [],
            player2: []
        }
    }

    io.on("connection", (socket) => {
        console.log(socket.id, 'connected');

        socket.on("add_player", ({ id, name }) => {
            let user = getUser(id)
            if (!user) addUser(id, name, socket.id)
            else socket.emit("user_exist")

            io.emit("online_players", users)
            // console.log(users);
        })

        socket.on("send_challange", ({ from, to }) => {
            console.log("Send Challange");
            let sender = getUser(from)
            let receiver = getUser(to)

            io.to(receiver?.socketId).emit("get_challange", { sender, receiver })
        })

        socket.on("challange_accepted", ({ sender, receiver }) => {
            console.log("Challange AC");
            cells = ['', '', '', '', '', '', '', '', '',]
            handleReset()
            let roomId = v4()

            sender = getUser(sender.id)
            receiver = getUser(receiver.id)

            if (!sender.roomId && !receiver.roomId) {
                updateUserRoom(sender.id, roomId)
                updateUserRoom(receiver.id, roomId)

                io.emit("online_players", users)

                sender.win = null
                receiver.win = null
                io.to(sender.socketId).to(receiver.socketId).emit("welcome_game", {
                    roomId,
                    sender: getUser(sender.id),
                    receiver: getUser(receiver.id),
                })
            }

        })

        socket.on("challange_rejected", ({ sender, receiver }) => {
            io.to(sender.socketId).emit("challange_reject_msg", receiver)
        })

        socket.on("send_room", ({ roomId }) => {
            console.log("Send Room");
            let room = users.filter(user => user.roomId == roomId)
            let p1 = users.find(u => u.id == room[0].id)
            let p2 = users.find(u => u.id == room[1].id)
            p1.win = null
            p2.win = null
            if (room.length == 2) {
                io.to(room[0].socketId).to(room[1].socketId).emit("get_room", { r: room })
            }
        })


        // TODO:
        socket.on("send_moves", ({ room, turn, index }) => {
            let winner = null
            if (turn) {
                cells[index] = 'X'
                move.player1.push(index);
                winner = checkWinner(move.player1, turn)
                turn = 0
            } else {
                cells[index] = 'O'
                move.player2.push(index);
                winner = checkWinner(move.player2, turn)
                turn = 1
            }
            if (winner == 0 || winner == 1 || winner == -1) {
                let p1 = users.find(u => u.id == room[0].id)
                let p2 = users.find(u => u.id == room[1].id)
                p1.roomId = null
                p2.roomId = null
                p1.win = winner
                p2.win = winner
                io.emit("online_players", users)
                // console.log({ users });
            }
            io.to(room[1].socketId).to(room[0].socketId).emit("get_moves", { c: cells, t: turn, winner: winner == -1 ? -1 : room[winner]?.id })

            // console.log(cells);
        })

        socket.on("disconnect", () => {
            let userRoom = users.find(u => u.socketId == socket.id)
            removeUser(socket.id)
            let opp = users.find(u => u.roomId == userRoom?.roomId)
            // console.log({ opp, userRoom });
            if (opp?.socketId) {
                opp.roomId = null
                io.to(opp.socketId).emit("user_left_room", { w: opp.win })
            }
            io.emit("online_players", users)
            console.log("A User Disconnected");
        })
    })
}



module.exports = socket_server