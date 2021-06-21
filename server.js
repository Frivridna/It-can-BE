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

// https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3
// https://dm0qx8t0i9gc9.cloudfront.net/watermarks/audio/S2O4GbbeUk52szlol/audioblocks-joyful-ride-20-seconds_HKQGTfonL_WM.mp3
const files = [
  'https://dm0qx8t0i9gc9.cloudfront.net/watermarks/audio/S2O4GbbeUk52szlol/audioblocks-joyful-ride-20-seconds_HKQGTfonL_WM.mp3',
  'https://dm0qx8t0i9gc9.cloudfront.net/watermarks/audio/S2O4GbbeUk52szlol/audioblocks-joyful-ride-20-seconds_HKQGTfonL_WM.mp3'
//  'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/Franz+Edvard+Cedrins+-+ICSLP.mp3'
]

io.on('connection', (socket) => {

  // Print connected user id
  console.log(`Connected: ${socket.id}`);

  // Print disconnected user id
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`)
  });

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
       io.emit('join', 'Room is full')
     }

     // Send files to users
     if (io.sockets.adapter.rooms.get(room) && io.sockets.adapter.rooms.get(room).size === 2) {
      
      // Create array of user ids from users in room
      const users = []
      console.log(users.length)
      io.emit('users', users.length) // NY
      io.sockets.adapter.rooms.get(room).forEach(user => users.push(user))

      // Send different files for each user
      users.forEach((user, index) => {
        io.sockets.sockets.get(user).emit('join', files[index])
      //  console.log('Sending url to user a', `$files[index]`)
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

// TODO: Add Franz som admin
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

// Remember to DELETE this endpoint after Franz have signed up too. 
/* app.post('/signup', async (req, res) => {
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
}) */

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
  },
/*   role: {
    type: String, // dropdown i FE som bestämmer A B unused
    enum:  ?? 
    required: true
  } */
})

const Sound = mongoose.model('Sound', urlSchema)


// Start defining routes
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

app.post('/sounds', authenticateAdmin)
app.post('/sounds', async (req,res) => {
  try {
    const newSound = await new Sound({
      name: req.body.name,
      url: req.body.url,
      description: req.body.description,
    //  role: req.body.role //
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
