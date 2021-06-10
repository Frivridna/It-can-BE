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

// generateRoomId ? detta är inte secret - ingen kryptering t.ex. enligt en som jobbar med internetsäkerhet. Se över terminologin. 
const setSecretCode = (length) => {
  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for ( let i = 0; i < length; i++ ) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length))
  }
  return result
}

let roleA = 'Role A'
let roleB = 'Role B'
let userRoleA
let userRoleB
let secret

io.on("connection", (socket) => {
  console.log("I am connected", socket.id)

  socket.on('create', () => {
    console.log("This is user A id", socket.id)
    console.log('room created')
    let secretCode = setSecretCode(4)
    let roleA = 'Role A'
    io.emit('sendCode', secretCode, roleA)
    socket.join(secretCode)
    console.log("This is first user joining", io.sockets.adapter.rooms.get(secretCode).size)
    socket.on('userA', (arg => {
      userRoleA=arg
      console.log(roleA===userRoleA)
   
    }))
  })
  // User B input 
  socket.on('join-room', (userBInput) => {
    console.log("This is user B id", socket.id)
    console.log(userBInput)
    //let roleB = 'Role B'
    socket.join(userBInput)
    console.log("This is second user joining", io.sockets.adapter.rooms.get(userBInput).size)
    socket.on('userB', (arg => {
      userRoleB = arg
      console.log(userRoleB)
      console.log(roleB===userRoleB)
    }))

    // CHANGE THIS: 
    // 1) Plocka ut socket.id - HUR gör vi det?
    // 2. Emit to only the socket id:s that is >= 2 and not to the room! 
    if (io.sockets.adapter.rooms.get(userBInput).size >= 2) {
      // OLDER: Test för att se vad som händer när vi emittar gloabalt till alla användare A resp. B. (not emitting to a room)
      if (roleA === userRoleA) {
        console.log('User A')
        // io.to(socketId).emit(/* ... */) ---> emit to specific user syntax. 
        // socket.to("room1").emit(/* ... */) ---> emit to room syntax. 
        socket.to(socket.id).emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3')
      } else if (roleB === userRoleB) {
        console.log('User B')
        socket.to(userBInput).emit('FromSecondAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/Franz+Edvard+Cedrins+-+ICSLP.mp3')
      }

      let amountOfPerson = io.sockets.adapter.rooms.get(userBInput).size >= 2
      // hämta ut rätt socket.id till användare nummer >=2
      //io.to(socketId).emit('status', "hej hej it's already ${amountOfPerson} persons in the room, please try again") 
      
      console.log(`Amount of users in room ${userBInput}`, io.sockets.adapter.rooms.get(userBInput).size)
      io.emit('status:', 'The room is currently occupied') // lägg in i FE  // NOT HAPPENING **
      } else { // join-room
        console.log('There are rooms still there to join for 1 user')
        // What to do instead of console.log here? 
      }
  })   
  socket.on('click', (click) => {
    // io.to('some room').emit('some event')
    //io.to(room+currentroom).emit('FromAPI', 'https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/testuppladdning.mp3')
    console.log('We have a click 1')
  })
})

// second file
// https://testfiles-caroline-fethullah.s3.eu-north-1.amazonaws.com/Franz+Edvard+Cedrins+-+ICSLP.mp3



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
