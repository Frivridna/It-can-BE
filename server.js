import mongoose from 'mongoose'
import express from 'express'
import cors from 'cors'
import listEndpoints from 'express-list-endpoints'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const http = require("http")
const app = express()
const server = http.createServer(app)
const { Server } = require("socket.io")

const port = process.env.PORT || 4001

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET, POST"]
  }
})

// const socket = io();
// const nsps = io.of('/');
// //const mainAdapter = io.of("/").adapter // behövs den här? 
// const roomno = 1;


// io.on('connection', (socket) => {
//   console.log('I am connected')
//   console.log(socket.id)
//  // console.log(io.of('/').sockets)
//   console.log(io.sockets)


   //console.log(io.sockets)
   //Increase roomno 2 clients are present in a room.
/*   if(io.nsps['/'].adapter.rooms["room-"+roomno] && io.nsps['/'].adapter.rooms["room-"+roomno].length > 1) roomno++;
socket.join("room-"+roomno);
console.log(roomno)
//Send this event to everyone in the room.
io.sockets.in("room-"+roomno).emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3'); */
//   })

// say that if socket id aka users > 2 --> Create a new room
//  let roomno = 1
let currentroom = 1 // just a counter :) 
const completeRooms = [] // ---> bygg om den här för att hålla reda på alla rum samt evt. hur många som är i detta rum. 

io.on("connection", (socket) => {
  console.log('I am connected')
  socket.join("global")
  console.log("Number of users in room global: "+io.sockets.adapter.rooms.get("global").size)
  //console.log(io.of('/').sockets)
/*   if(io.rooms[`${"room-" +roomno}`] && io.rooms[`${"room-" +roomno}`].length > 1) roomno++
  socket.join("room-" +roomno) */

  let room = "room"+currentroom
  let newRoom = "room"+(currentroom+1)

  socket.on('create', () => {
    if (io.sockets.adapter.rooms.get(room) || io.sockets.adapter.rooms.get(room).size >= 2) {
      currentroom++;
      socket.join(newRoom)
      console.log("Created new room "+ newRoom +".")
    } else {
      socket.join(room)
      completeRooms.push(room)
      console.log("Pushed "+ room +" to complete rooms.")
    }
    //socket.rooms.size = 2 
    //io.sockets.adapter.rooms.get(roomName).size // Code to check how many users is in one room. 

    //console.log(io.sockets.adapter.rooms) // list all rooms aka all open browsers 


    // io.sockets.rooms
    //console.log(io.sockets.rooms)
    
    //const roomno = 1
    //console.log(newRoom)
  
/*     let amountOfUser = newRoom++
    console.log(amountOfUser) */

/*     const users = function (roomno) {
        return socket.rooms[roomno]
     } */

    //if any of the current rooms have only one
    //user, join that room. 
/*       rooms.forEach(room => {
      console.log(room.length)
      if (users(room).length === 1) {
        socket.join(room)
      } else {
      socket.join(newRoom)
      } */
    })
//  })
  socket.on('click', (click) => {
    io.emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3')
    console.log('We have a click')
  })
})

// ROOM SECTION
io.on("connection", (socket) => {
  socket.on("big-poppa", (arg, room) => {
    if(room!=="") { //if(arg2 === "Turtles")
      return(
        io.on("connection", (socket) => {
          console.log('I am connected')
          socket.on('click', (click) => {
            io.emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3');
            console.log('We have a click');
          });
        })
      )
    } else {
      return(
        console.log(arg)
      )
    }
  });
  socket.on ('join-room', room => {
    console.log(room)
    socket.join(room)
  })
  // Här placeholder
});



const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/sounds"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
mongoose.Promise = Promise

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// Add Caroline and Fethullah as admin
const Admin = mongoose.model('Admin', {
  username: {
    type: String, 
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
})

const authenticateAdmin = async (req, res, next) => {
  const accessToken = req.header('Authorization')
  try {
    const admin = await Admin.findOne({ accessToken })
    if (admin) {
      next()
    } else {
      res.status(401).json({ success: false, loggedOut: true, message: "Not authenticated" })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error})
  }
}

// Remember to DELETE this endpoint after we have signed up ONCE, and have connected to MongoAtlas *** 
app.post('/signup', async (req, res) => {
  const { username, password } = req.body

  try {
    const salt = bcrypt.genSaltSync();
    const newAdmin = await new Admin ({
      username, 
      password: bcrypt.hashSync(password, salt)
    }).save();
    if (newAdmin) {
      res.json({
        success: true,
        userID: newAdmin._id,
        username: newAdmin.username,
        accessToken: newAdmin.accessToken
      });
    }
  } catch(error) {
    if(error.code===11000){
      res.status(400).json({ success: false, error: 'Username already exists', field: error.keyValue })
    }
    res.status(400).json({ success: false, message: 'Invalid Request', error })
  }
})

app.post('/signin', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username })
    if (admin && bcrypt.compareSync(password, admin.password)) {
      res.json({
        success: true,
        userID: admin._id,
        username: admin.username,
        accessToken: admin.accessToken
      })
    } else {
      res.status(404).json({ success: false, message: "User not found" })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error })
  }
})

// Add sound
const urlSchema = new mongoose.Schema({
  name: {
    type: String,
    unique:true,
    required: true
  },
  url: {
    type: String,
    unique: true,
    required: true
  },
  description: {
    type: String,
    trim: true,
    required: true
  }
})

const Sound = mongoose.model('Sound', urlSchema)


// Start defining routes
app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

app.get('/sounds', authenticateAdmin)
app.get('/sounds', async (req,res) => {
  const allSounds = await Sound.find()
  res.json(allSounds)
});

app.post('/sounds', authenticateAdmin)
app.post('/sounds', async (req,res) => {
  try {
    const newSound = await new Sound({
      name: req.body.name,
      url: req.body.url,
      description: req.body.description
    }).save(); 
    res.json(newSound);
  } catch (error) {
    if(error.code===11000){
      res.status(400).json({ error: 'Duplicated value', field: error.keyValue })
    }
    res.status(400).json(error)
  }
})

app.delete('/sounds/:id', authenticateAdmin)
app.delete('/sounds/:id', async (req, res) => {
  const { id } = req.params

  try {                          
    const deletedSound = await Sound.findByIdAndDelete(id) 
    if (deletedSound) {
      res.status(200).json(deletedSound)
    } else {
      res.status(404).json({ message: 'Not found' })
    } 
  } catch (error) { 
    res.status(400).json({ message: 'Invalid request', error })
  }
})

app.put('/sounds/:id', authenticateAdmin)
app.put('/sounds/:id', async (req, res) => {
  const {id} = req.params

  try {                                                  
    const updatedSound = await Sound.findOneAndReplace({ _id: id }, req.body, { new: true })
    if (updatedSound) {
      res.status(200).json(updatedSound)
    } else {
      res.status(404).json({ message: 'Not found'})
    }
  } catch(error) {
    res.status(400).json({ message: 'Invalid request', error })
  }
})

// Start the server
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
