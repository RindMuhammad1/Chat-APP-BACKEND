const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

// Initialize Express and HTTP Server
const app = express();
const server = http.createServer(app);

// Setup socket.io with CORS
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3001",
        methods: ["GET", "POST"]
    }
});

// MongoDB connection setup
mongoose.connect('mongodb://localhost:27017/chat-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('Failed to connect to MongoDB:', err));

// Room Schema and Model
const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: String,
    createdAt: { type: Date, default: Date.now }
});

//  User Schema and Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    socketId: { type: String, required: true },
    roomName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

//  Message Schema and Model
const messageSchema = new mongoose.Schema({
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    sender: String,
    message: String,
    createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);
const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// socket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // create  Room Handler
    socket.on('createRoom', async ({ name, description }) => {
        if (!name) {
            socket.emit('error', 'Room name is required.');
            return;
        }
        try {
            let room = await Room.findOne({ name });
            if (room) {
                socket.emit('error', 'Room already exists.');
                return;
            }
            room = new Room({ name, description });
            await room.save();
            socket.join(room._id.toString());
            socket.emit('roomCreated', { roomName: room.name, roomId: room._id });
            socket.broadcast.emit('notification', `New room created: ${room.name}`);
        } catch (err) {
            console.error('Error creating room:', err);
            socket.emit('error', 'Error creating room: ' + err.message);
        }
    });

    // Join Room Handler
    socket.on('joinRoom', async ({ username, name }) => {
        try {
            const room = await Room.findOne({ name });
            if (!room) {
                socket.emit('error', 'Room not found.');
                return;
            }

            let user = new User({ username, socketId: socket.id, roomName: name });
            await user.save();

            socket.join(room._id.toString());

            const messages = await Message.find({ room: room._id }).limit(10).sort({ createdAt: -1 });
            socket.emit('joinedRoom', { roomName: room.name, roomId: room._id, messages: messages.reverse() });

            const roomUsers = await User.find({ roomName: name, socketId: { $ne: socket.id } }).select('username socketId');

            io.to(room._id.toString()).emit('recipients', roomUsers);

            socket.broadcast.to(room._id.toString()).emit('notification', `${username} joined the room`);
        } catch (err) {
            console.error('Error joining room:', err);
            socket.emit('error', 'Failed to join room: ' + err.message);
        }
    });

    // Send Message Handler
    socket.on('sendMessage', async ({ roomId, sender, message }) => {
        if (!roomId || !message) {
            socket.emit('error', 'Message and room ID are required.');
            return;
        }
        try {
            const newMessage = new Message({ room: roomId, sender, message });
            await newMessage.save();
            io.to(roomId).emit('newMessage', newMessage);
        } catch (err) {
            console.error('Error sending message:', err);
            socket.emit('error', 'Failed to send message: ' + err.message);
        }
    });

    // Handle private message sending
    socket.on('sendPrivateMessage', async ({ recipientUsername, message }) => {
        try {
            const recipient = await User.findOne({ username: recipientUsername });
            if (!recipient) {
                socket.emit('error', 'Recipient not found.');
                return;
            }

            const senderUser = await User.findOne({ socketId: socket.id });
            if (!senderUser) {
                socket.emit('error', 'Sender user not found.');
                return;
            }

            const privateMessage = {
                sender: senderUser.username,
                message,
                createdAt: new Date()
            };

            // Send private message to recipient
            socket.to(recipient.socketId).emit('privateMessage', privateMessage);
            socket.emit('privateMessage', privateMessage);

        } catch (err) {
            console.error('Error sending private message:', err);
            socket.emit('error', 'Failed to send private message: ' + err.message);
        }
    });

    // Typing Indicator Handler
    socket.on('typing', ({ roomId, sender }) => {
        socket.to(roomId).broadcast.emit('typing', { sender });
    });

    // Disconnect Handler
    socket.on('disconnect', async () => {
        try {
            const disconnectedUser = await User.findOne({ socketId: socket.id });

            if (disconnectedUser) {
                const { roomName, username } = disconnectedUser;

                await User.deleteOne({ socketId: socket.id });

                const roomUsers = await User.find({ roomName }).select('socketId username');

                io.to(roomName).emit('recipients', roomUsers);

                socket.broadcast.to(roomName).emit('notification', `${username} left the room`);
            }
        } catch (err) {
            console.error('Error handling disconnect:', err);
        }

        console.log('User disconnected:', socket.id);
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server running on port 3000');
});
