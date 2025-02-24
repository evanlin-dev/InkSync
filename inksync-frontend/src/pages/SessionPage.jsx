import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams } from "react-router-dom";
import './css/SessionPage.css';

function SessionPage() {
    const { id } = useParams();
    const [users, setUsers] = useState([]);
    const [data, setData] = useState();
    const [localCoords, setLocalCoords] = useState({ x: 0, y: 0 });
    const [lastCoords, setLastCoords] = useState({ x: 0, y: 0 });
    const [loadingTime, setLoadingTime] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef(null);

    const handleMouseDown = () => {
        setIsDrawing(true);  // Start drawing
    };

    const handleMouseUp = () => {
        setIsDrawing(false);  // Stop drawing
    };

    const handleMouseMove = event => {
        const newCoords = {
            x: event.clientX - event.target.offsetLeft,
            y: event.clientY - event.target.offsetTop,
        };
        setLocalCoords(newCoords);
        if (isDrawing) {
            modifyImage(lastCoords.x, lastCoords.y, newCoords.x, newCoords.y);
        }
    };
    const modifyImage = (startX, startY, endX, endY) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgb(255, 0, 0)'; // Pixel color

        // Draw between the two points
        ctx.beginPath();
        ctx.moveTo(startX, startY);  // Move to the start point
        ctx.lineTo(endX, endY);  // Draw to the end point
        ctx.lineWidth = 1;
        ctx.stroke();  // Apply the line

        // Update lastCoords to the current mouse position
        setLastCoords({ x: endX, y: endY });
    };

    useEffect(() => {
        // Initialize lastCoords when the drawing starts
        setLastCoords(localCoords);
    }, [isDrawing]);

    const arrayToImage = () => {
        if (!data || data.length === 0 || data[0].length === 0) {
            return;
        }

        const startTime = performance.now();

        const height = data.length;
        const width = data[0].length;
        const canvas = canvasRef.current;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const imgData = ctx.createImageData(width, height);

        // Convert hex to a number (0-255 range)
        const convertToNumber = (hex) => {
            return parseInt(hex, 16);
        };

        let index = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const hexColor = data[y][x]; // Get the hex color for the current pixel
                const red = convertToNumber(hexColor.substring(1, 3));
                const green = convertToNumber(hexColor.substring(3, 5));
                const blue = convertToNumber(hexColor.substring(5, 7));

                // Set the RGBA values in imgData
                imgData.data[index + 0] = red;   // Red channel
                imgData.data[index + 1] = green; // Green channel
                imgData.data[index + 2] = blue;  // Blue channel
                imgData.data[index + 3] = 255;   // Alpha channel (fully opaque)

                index += 4; // Move to the next pixel in the ImageData array
            }
        }

        // Put the image data onto the canvas
        ctx.putImageData(imgData, 0, 0);

        const endTime = performance.now();
        const loadTime = endTime - startTime;
        setLoadingTime(loadTime);
    };

    useEffect(() => {
        axios.get(`http://localhost:8080/sessions/${id}`)
            .then(response => {
                setUsers(response.data.users);
                setData(response.data.image);
            })
            .catch(error => {
                console.error('Error fetching sessions:', error);
            });
    }, [id]);

    useEffect(() => {
        if (data) {
            arrayToImage();
        }
    }, [data]);

    return (
        <div className="session-page">
            <h1>Welcome to the Session Page</h1>
            <h1>Session ID: {id}</h1>
            <ul>
                {users.map((user, index) => (
                    <li key={index}>
                        {user}
                    </li>
                ))}
            </ul>
            <h2>
                Relative: ({localCoords.x}, {localCoords.y})
            </h2>
            {loadingTime !== null && (
                <h3>Canvas render time: {loadingTime.toFixed(2)} ms</h3>
            )}
            <canvas
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp} 
                ref={canvasRef}
            />
        </div>
    );
}

export default SessionPage;
