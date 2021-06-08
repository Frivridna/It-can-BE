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

// console.log(socket.id)
// console.log(io.of('/').sockets)
//socket.rooms.size 
//console.log(io.sockets.adapter.rooms) // list all rooms aka all open browsers 

let currentroom = 1 // just a counter :) 
const completeRooms = [] // ---> bygg om den här för att hålla reda på alla rum samt evt. hur många som är i detta rum. 

// ROOM SECTION
io.on("connection", (socket) => {
  console.log('I am connected 1')
  socket.join("global")
  console.log("Number of users in room global: "+io.sockets.adapter.rooms.get("global").size)
  //   console.log(io.sockets)

  let room = "room"+currentroom
  let newRoom = "room"+(currentroom+1)

  socket.on('create', () => {
    socket.join(room)
    if (io.sockets.adapter.rooms.get(room) || io.sockets.adapter.rooms.get(room).size >= 2) {
      currentroom++
      console.log("Created new room "+ newRoom +".")
      console.log("Amount of users in room ", io.sockets.adapter.rooms.get(room).size )
    } else {
      socket.join(room)
      completeRooms.push(room)
      console.log("Pushed "+ room +" to complete rooms.")
      console.log(completeRooms)
    }
  })

/*   socket.on('click', (click) => {
    io.emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3')
    console.log('We have a click 1')
  }) */

  // GENERATE RANDOM CODE TO USER A:
const setSecretCode = (length) => {
  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for ( let i = 0; i < length; i++ ) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length))
  }
  return result
}

console.log(setSecretCode(4)) // run this function when user clicked "Create Room"

  socket.on("big-poppa", (arg, room) => {
    if(room!=="") { 
          socket.on('click', (click) => {
            io.emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3');
            console.log('We have a click 2');
          });
    } else {
        console.log(arg)
    }
  })
})
// ROOM SECTION ENDS
/*   socket.on ('join-room', room => {
    console.log(room)
    socket.join(room)
  }) */

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/sounds"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
mongoose.Promise = Promise

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// TODO: Add Caroline and Fethullah as admin
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
