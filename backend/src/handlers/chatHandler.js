const Chat = require('../models/Chat');

const chatHandler = (io, socket) => {
  console.log(`User ${socket.user.name} connected to chat`);

  // Join a chat room
  socket.on('join_chat', async (data) => {
    try {
      const { chatId } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      // Verify user is authorized for this chat
      if (!chat.isAuthorized(socket.userId)) {
        socket.emit('error', { message: 'Unauthorized access to this chat' });
        return;
      }

      // Join the room
      socket.join(chatId);
      console.log(`User ${socket.user.name} joined chat ${chatId}`);
      
      // Mark messages as read
      await chat.markMessagesAsRead(socket.userId);
      
      socket.emit('joined_chat', { chatId });
      
      // Notify other participants that user is online
      socket.to(chatId).emit('user_online', {
        userId: socket.userId,
        userName: socket.user.name
      });

    } catch (error) {
      console.error('Join chat error:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  // Leave a chat room
  socket.on('leave_chat', (data) => {
    const { chatId } = data;
    socket.leave(chatId);
    console.log(`User ${socket.user.name} left chat ${chatId}`);
    
    // Notify other participants that user is offline
    socket.to(chatId).emit('user_offline', {
      userId: socket.userId,
      userName: socket.user.name
    });
  });

  // Send a message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content } = data;

      if (!content || content.trim().length === 0) {
        socket.emit('error', { message: 'Message content is required' });
        return;
      }

      if (content.trim().length > 1000) {
        socket.emit('error', { message: 'Message too long (max 1000 characters)' });
        return;
      }

      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      if (!chat.isAuthorized(socket.userId)) {
        socket.emit('error', { message: 'Unauthorized access to this chat' });
        return;
      }

      if (!chat.isActive) {
        socket.emit('error', { message: 'Chat is no longer active' });
        return;
      }

      // Add message to chat
      await chat.addMessage(socket.userId, content.trim());
      await chat.populate('messages.sender', 'name');

      const newMessage = chat.messages[chat.messages.length - 1];

      // Broadcast message to all participants in the room
      io.to(chatId).emit('new_message', {
        message: {
          _id: newMessage._id,
          sender: {
            _id: newMessage.sender._id,
            name: newMessage.sender.name
          },
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          read: newMessage.read
        },
        chatId
      });

      console.log(`Message sent in chat ${chatId} by ${socket.user.name}`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing_start', (data) => {
    const { chatId } = data;
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      userName: socket.user.name
    });
  });

  socket.on('typing_stop', (data) => {
    const { chatId } = data;
    socket.to(chatId).emit('user_stopped_typing', {
      userId: socket.userId,
      userName: socket.user.name
    });
  });

  // Mark messages as read
  socket.on('mark_as_read', async (data) => {
    try {
      const { chatId } = data;

      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      if (!chat.isAuthorized(socket.userId)) {
        socket.emit('error', { message: 'Unauthorized access to this chat' });
        return;
      }

      await chat.markMessagesAsRead(socket.userId);

      // Notify other participants
      socket.to(chatId).emit('messages_read', {
        userId: socket.userId,
        userName: socket.user.name
      });

    } catch (error) {
      console.error('Mark as read error:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${socket.user.name} disconnected from chat`);
  });
};

module.exports = chatHandler; 