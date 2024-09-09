import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Container, Row, Col, Form, FormGroup, Label, Input, Button, Alert, ListGroup, ListGroupItem } from 'reactstrap';

const socket = io('http://localhost:3000');

const App = () => {
    const [username, setUsername] = useState('');
    const [roomName, setRoomName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [errors, setErrors] = useState('');
    const [typing, setTyping] = useState(false);

    const messageEndRef = useRef(null);

    useEffect(() => {
        socket.on('newMessage', (msg) => {
            setMessages((prevMessages) => [...prevMessages, msg]);
            setTyping(false);
        });

        socket.on('roomCreated', ({ roomId, roomName }) => {
            setRoomId(roomId);
            setRoomName(roomName);
            setErrors('');
        });

        socket.on('joinedRoom', ({ roomId, roomName, messages }) => {
            setRoomId(roomId);
            setRoomName(roomName);
            setMessages(messages);
            setErrors('');
        });

        socket.on('error', (error) => {
            setErrors(error);
        });

        socket.on('typing', ({ sender }) => {
            setTyping(true);
        });

        return () => {
            socket.off('newMessage');
            socket.off('roomCreated');
            socket.off('joinedRoom');
            socket.off('error');
            socket.off('typing');
        };
    }, []);

    const handleCreateRoom = () => {
        if (!roomName) {
            setErrors('Room name is required to create a room.');
            return;
        }
        socket.emit('createRoom', { name: roomName, description: 'No description' });
    };

    const handleJoinRoom = () => {
        if (!roomName) {
            setErrors('Room name is required to join a room.');
            return;
        }
        socket.emit('joinRoom', { name: roomName });
    };

    const handleSendMessage = () => {
        if (!message) {
            setErrors('Message cannot be empty.');
            return;
        }
        socket.emit('sendMessage', { roomId, sender: username, message });
        setMessage('');
    };

    const handleTyping = () => {
        socket.emit('typing', { roomId, sender: username });
    };

    return (
        <Container>
            <Row className="justify-content-center">
                <Col sm={8}>
                    <Form>
                        <FormGroup>
                            <Label for="username">Username:</Label>
                            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                        </FormGroup>
                        <FormGroup>
                            <Label for="roomName">Room Name:</Label>
                            <Input id="roomName" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
                        </FormGroup>
                        <FormGroup>
                            <Button onClick={handleCreateRoom}>Create Room</Button>
                            <Button onClick={handleJoinRoom}>Join Room</Button>
                        </FormGroup>
                        <FormGroup>
                            <Label for="message">Message:</Label>
                            <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} onKeyUp={handleTyping} />
                            <Button onClick={handleSendMessage}>Send</Button>
                        </FormGroup>
                        {errors && <Alert color="danger">{errors}</Alert>}
                        <ListGroup>
                            {messages.map((msg, index) => (
                                <ListGroupItem key={index}>{msg.sender}: {msg.message}</ListGroupItem>
                            ))}
                        </ListGroup>
                        {typing && <div>Someone is typing...</div>}
                        <div ref={messageEndRef} />
                    </Form>
                </Col>
            </Row>
        </Container>
    );
};

export default App;
