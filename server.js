import mongoose from 'mongoose'
import express from 'express'
import cors from 'cors'
import listEndpoints from 'express-list-endpoints'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import dotenv from 'dotenv'

const http = require("http")
const app = express()
const server = http.createServer(app)
const { Server } = require("socket.io")

dotenv.config()

const port = process.env.PORT || 4001

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET, POST"]
  }
})

io.on('connection', (socket) => {

  // Print connected user id
  console.log(`Connected: ${socket.id}`)

  // Print disconnected user id
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`)
  })

  // Join room event
  socket.on('join', (room) => {

     // Join first person to room
     if (!io.sockets.adapter.rooms.get(room)) {
       console.log('First person', socket.id, room)
       socket.join(room)

     // Join second person to room
     } else if (io.sockets.adapter.rooms.get(room) && io.sockets.adapter.rooms.get(room).size < 2) {
       console.log('Second person', socket.id, room)
       socket.join(room)

     // Disallow more than 2 people in same room  
     } else {
       console.log('Full', socket.id)
       //io.emit('fullRoom', 'Room is full') --> Going to be used in future

       const users = []
      //io.emit('users', users.length)
      io.sockets.adapter.rooms.get(room).forEach(user => users.push(user))

      // Emit room is full to 3rd user
      users.forEach((user, index) => {
          if (index === 2) {
            io.sockets.sockets.get(user).emit('join', 'Room is full')
          } 
      })
     }

     // Send files to 2 users - starting here: 
     if (io.sockets.adapter.rooms.get(room) && io.sockets.adapter.rooms.get(room).size === 2) {
      
      // Create array of user ids from users in room
      const users = []
      io.emit('users', users.length)
      io.sockets.adapter.rooms.get(room).forEach(user => users.push(user))

      // Send different files for each user
      users.forEach((user, index) => {
//        io.sockets.sockets.get(user).emit('join', queriedPlay[index]) --> Going to be used in future
          io.sockets.sockets.get(user).emit('join', index)
      })
     }
  })
})

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/sounds"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
mongoose.Promise = Promise

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

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

// urlSchema
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
  },
  playable: { 
    type: Boolean,
  }
})

const Sound = mongoose.model('Sound', urlSchema)


// ROUTES
app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

app.get('/sounds', authenticateAdmin)
app.get('/sounds', async (req,res) => {
  const allSounds = await Sound.find()
  res.json({
    success: true,
    data: allSounds
  }) 
  console.log(allSounds)
})

app.get('/sounds/play/:user', async (req, res) => {
  const { user } = req.params
  
  const queriedPlay = await Sound.find()
    res.json({
      success: true,
      data: queriedPlay[user]
    })
})

app.post('/sounds', authenticateAdmin)
app.post('/sounds', async (req,res) => {
  try {
    const newSound = await new Sound({
      name: req.body.name,
      url: req.body.url,
      description: req.body.description,
      playable: req.body.playable
    }).save()
    res.json({
      success: true,
      data: newSound
    })
  } catch (error) {
    if(error.code===11000){
      res.status(400).json({ success: false, error: 'Duplicated value', field: error.keyValue })
    }
    res.status(400).json({success: false, error })
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

// Going to be used in the future
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

// Start server
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
