"use client";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Avatar,
  CircularProgress,
  IconButton,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import axios from "axios";

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = {
      text: input,
      sender: "user",
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    try {
      const res = await axios.post("/api/chat", { query: input });
      setMessages((prev) => [
        ...prev,
        {
          text: res.data.reply,
          sender: "bot",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          text: "Sorry, something went wrong. Please try again.",
          sender: "bot",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: "auto",
        p: 4,
        display: "flex",
        flexDirection: "column",
        height: "80vh",
        bgcolor: "grey.50",
      }}
    >
      <Typography
        variant="h4"
        sx={{ mb: 2, textAlign: "center", color: "primary.main" }}
      >
        Personal AI Chatbot
      </Typography>
      <Paper
        elevation={3}
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          mb: 2,
          borderRadius: 2,
          backgroundColor: "#fafafa",
        }}
      >
        <motion.div className="space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <Box
                sx={{
                  maxWidth: "70%",
                  p: 2,
                  borderRadius: 3,
                  backgroundColor:
                    msg.sender === "user" ? "#1976d2" : "#e3f2fd",
                  color: msg.sender === "user" ? "white" : "text.primary",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  boxShadow: 1,
                }}
              >
                {msg.sender === "bot" && (
                  <Avatar
                    sx={{
                      bgcolor: "#1976d2",
                      width: 32,
                      height: 32,
                      fontSize: "1rem",
                    }}
                  >
                    AI
                  </Avatar>
                )}
                <Box>
                  <Typography variant="body1" sx={{ mb: 0.5 }}>
                    {msg.text}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {msg.timestamp}
                  </Typography>
                </Box>
                {msg.sender === "user" && (
                  <Avatar
                    sx={{
                      bgcolor: "#1976d2",
                      width: 32,
                      height: 32,
                      fontSize: "1rem",
                    }}
                  >
                    U
                  </Avatar>
                )}
              </Box>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  AI is typing...
                </Typography>
              </Box>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </motion.div>
      </Paper>
      <Box display="flex" alignItems="center" gap={1}>
        <TextField
          value={input}
          onChange={(e) => setInput(e.target.value)}
          fullWidth
          variant="outlined"
          placeholder="Type your message..."
          disabled={isLoading}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
        />
        <IconButton
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          sx={{ bgcolor: "primary.main" }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
