# InkSync Collaborative Drawing

InkSync is a real-time collaborative drawing application that allows multiple users to draw on a shared canvas. The project is built using an Express backend with WebSocket support for live updates and a React frontend for an interactive drawing interface. It also uses MongoDB to persist session data and MessagePack to efficiently encode/decode drawing data.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation and Running Locally](#installation-and-running-locally)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Video Demos](#video-demos)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)
- [License](#license)

---

## Features

- **Real-Time Collaboration:** Multiple users can draw on the same canvas simultaneously.
- **Vector-Based Drawing:** Instead of sending pixel data, only vector instructions (coordinates, brush size, color, etc.) are transmitted.
- **Undo/Redo Functionality:** Each user can undo or redo their drawing actions.
- **Shape Tools:** In addition to freehand drawing, users can draw basic shapes (square, circle, triangle, hexagon).
- **Session Persistence:** Sessions are saved in MongoDB using a compact MessagePack format.
- **Responsive Interface:** The React frontend provides an intuitive interface with a color picker, brush size slider, and tool selection.

---

## Prerequisites

- [Node.js (v14+)](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/) instance (local or cloud)
- Package manager: npm or yarn

---

## Installation and Running Locally

1. **Clone the Repository:**

   ```
   git clone https://github.com/evanlin-dev/InkSync.git
   cd InkSync
   ```

2. **Install the Dependencies:**

    ```
    cd inksync-frontend
    npm install
    ```

    or

    ```
    cd inksync-frontend
    yarn install
    ```

3. **Environment Variables**
    Create a .env file in the inkysync-backend directory with the following variables:
    ```
    MONGO_URI=<your-mongodb-connection-string>
    ```

4. **Start the servers**
    ```
    Frontend
    cd inksync-frontend
    npm run dev
    ```

    ```
    Backend
    cd inksync-backend
    node index.js
    ```

## Usage

- **Creating a Session**:
        On the homepage, enter your user name and click Create Session.
        The backend creates a new session in MongoDB and returns a unique session ID.
        You will be redirected to a drawing session page where you can start drawing.

- **Joining a Session**:
        Enter your user name and the session ID in the join session form.
        Upon joining, you will see the existing canvas.

- **Drawing and Tools**:
        Use the brush or eraser tool to draw on the canvas.
        Use shape tools (square, circle, triangle, hexagon) to add vector shapes.
        Use the undo (Ctrl+Z) and redo (Ctrl+Y) shortcuts to modify your drawing.
        Change the brush size using the slider and adjust colors with the color picker.

## Video Demos

**1. Live Demo: Creating and Joining Sessions**  
**Description:** A live demo showing session creation, joining, and real-time drawing collaboration between multiple users.  
[Watch Video](https://raw.githubusercontent.com/evanlin-dev/InkSync/main/video1.mp4)
[Watch Video](https://raw.githubusercontent.com/evanlin-dev/InkSync/main/video1.mp4)
