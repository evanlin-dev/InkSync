import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams } from "react-router-dom";
import Sketch from '@uiw/react-color-sketch';
import './css/SessionPage.css';
import SliderComponent from '../components/Slider';
import { useBeforeUnload } from 'react-router-dom';

function SessionPage() {
    const { id } = useParams();
    const [data, setData] = useState();
    const [localCoords, setLocalCoords] = useState({ x: 0, y: 0 });
    const [lastCoords, setLastCoords] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(1);
    const [isEraser, setIsEraser] = useState(false);
    const [hex, setHex] = useState("#fff");
    const [disableAlpha, setDisableAlpha] = useState(true);
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const [commandStack, setCommandStack] = useState([]);
    const currentCommandRef = useRef(null);
    const [currentCommandIndex, setCurrentCommandIndex] = useState(0)
    const [backgroundImageData, setBackgroundImageData] = useState(null);

    // Create WebSocket connection when the component mounts
    useEffect(() => {
        if (!socketRef.current) {
            socketRef.current = new WebSocket(`ws://localhost:8080/${id}`);
            console.log("WebSocket created for session:", id);

            socketRef.current.onopen = () => {
                console.log("WebSocket connection opened");
            };

            socketRef.current.onclose = () => {
                console.log("WebSocket connection closed");
            };

            socketRef.current.onerror = (error) => {
                console.error("WebSocket error:", error);
            };

            // Handle incoming messages from other users
            socketRef.current.onmessage = (msg) => {
                const receivedData = JSON.parse(msg.data);
                console.log("Received drawing update:", receivedData);

                // Apply the received drawing updates to the canvas
                modifyImage(
                    receivedData.lastCoords.x,
                    receivedData.lastCoords.y,
                    receivedData.newCoords.x,
                    receivedData.newCoords.y,
                    receivedData.hex,
                    receivedData.brushSize,
                    receivedData.isEraser
                );
            };
        }
        return () => {
            if (socketRef.current) {
                console.log("Closing WebSocket connection for session:", id);
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [id]);
    useEffect(() => {
        // Fetch session data
        axios.get(`http://localhost:8080/sessions/${id}`)
            .then(response => {
                setData(response.data.image);  // Set image data
            })
            .catch(error => {
                console.error('Error fetching session data:', error);
            });
    }, [id]);

    useEffect(() => {
        if (data) {
            arrayToImage(); // Update canvas with fetched image data
        }
    }, [data]);

    // Function to undo the last action
    const undo = () => {
        if (currentCommandIndex >= 0) {
            setCurrentCommandIndex(currentCommandIndex - 1);
            socketRef.current.send(JSON.stringify({
                action: 'undo',
            }));
        };
    }

    // Function to redo the undone action
    const redo = () => {
        if (currentCommandIndex < commandStack.length) {
            setCurrentCommandIndex(currentCommandIndex + 1);
            socketRef.current.send(JSON.stringify({
                action: 'redo',
            }));
        }
    };

    useEffect(() => {
        // Log the current command stack at the updated index after the state has changed
        if (currentCommandIndex >= 0 && currentCommandIndex < commandStack.length) {
            redrawCanvas();
            // console.log(commandStack[currentCommandIndex]);
        }
    }, [currentCommandIndex]);  // This effect will run when currentCommandIndex changes
    

    const redrawCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
    
        // Clear the canvas, but keep the background intact
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
        // Redraw all commands up to the current command index
        for (let i = 0; i <= currentCommandIndex; i++) {
            const command = commandStack[i];
    
            if (command.type === 'background') {
                // Draw the background image for this command
                ctx.putImageData(command.imageData, 0, 0);
            } else if (command.type === 'stroke') {
                // Redraw strokes
                ctx.strokeStyle = command.color;
                ctx.lineWidth = command.brushSize;
                ctx.lineCap = 'round';
    
                command.segments.forEach(segment => {
                    ctx.beginPath();
                    ctx.moveTo(segment.startX, segment.startY);
                    ctx.lineTo(segment.endX, segment.endY);
                    ctx.stroke();
                });
            }
        }
    };
    

    const handleMouseDown = (event) => {
        setIsDrawing(true);

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const newCoords = {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };

        setLastCoords(newCoords);

        // Start a new command (stroke) and capture the current drawing properties
        currentCommandRef.current = {
            segments: [],  // Will store each segment drawn during this stroke
            color: changeColor(),
            brushSize: brushSize,
            isEraser: isEraser
        };
    };

    const handleMouseUp = () => {
        setIsDrawing(false);  // Stop drawing
        if (currentCommandRef.current) {
            const temp = currentCommandRef.current;
            temp.type = 'stroke';  // Mark this as a stroke command
            setCommandStack(prev => [...prev, temp]);
            setCurrentCommandIndex(currentCommandIndex + 1);
            currentCommandRef.current = null;
        }
    };
    

    const handleMouseMove = event => {
        // Get the position of the canvas relative to the viewport
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const newCoords = {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
        setLocalCoords(newCoords);

        // If the user is drawing, modify the image
        if (isDrawing) {
            socketRef.current.send(JSON.stringify({
                lastCoords,
                newCoords,
                hex,
                brushSize,
                isEraser
            }));
            // Record the current segment into the command
            if (currentCommandRef.current) {
                currentCommandRef.current.segments.push({
                    startX: lastCoords.x,
                    startY: lastCoords.y,
                    endX: newCoords.x,
                    endY: newCoords.y
                });
            }
            modifyImage(lastCoords.x, lastCoords.y, newCoords.x, newCoords.y, changeColor(), brushSize, isEraser);
        }
    };

    const modifyImage = (startX, startY, endX, endY, color, size, eraser) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = eraser ? 'rgb(255, 255, 255)' : color;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineCap = "round";
        ctx.lineWidth = size;
        ctx.stroke();

        setLastCoords({ x: endX, y: endY });
    };

    useEffect(() => {
        // Initialize lastCoords when the drawing starts
        setLastCoords(localCoords);
    }, [isDrawing]);

    // Convert hex to a number (0-255 range)
    const convertToNumber = (hex) => {
        return parseInt(hex, 16);
    };

    const changeColor = () => {
        const red = convertToNumber(hex.substring(1, 3));
        const green = convertToNumber(hex.substring(3, 5));
        const blue = convertToNumber(hex.substring(5, 7));
        return `rgb(${red}, ${green}, ${blue})`;
    };

    const handleBrushSizeChange = (value) => {
        setBrushSize(value);
    };

    const arrayToImage = () => {
        if (!data || data.length === 0 || data[0].length === 0) {
            return;
        }
    
        const height = data.length;
        const width = data[0].length;
        const canvas = canvasRef.current;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
    
        const imgData = ctx.createImageData(width, height);
        let index = 0;
    
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const hexColor = data[y][x];
                const red = convertToNumber(hexColor.substring(1, 3));
                const green = convertToNumber(hexColor.substring(3, 5));
                const blue = convertToNumber(hexColor.substring(5, 7));
    
                imgData.data[index + 0] = red;
                imgData.data[index + 1] = green;
                imgData.data[index + 2] = blue;
                imgData.data[index + 3] = 255;
    
                index += 4;
            }
        }
    
        // Add background change as a command
        const backgroundCommand = {
            type: 'background',  // New command type for background change
            imageData: imgData,   // Store the background image data
        };
    
        setBackgroundImageData(imgData);  // Update the state for background image data
    
        // Add background change to command stack
        setCommandStack(prev => [...prev, backgroundCommand]);
        setCurrentCommandIndex(prevIndex => prevIndex + 1);
    
        // Draw the background
        ctx.putImageData(imgData, 0, 0);
    };
    

    return (
        <div className='session-page-container'>
            <div className='body-container'>
                <div className='left-sidebar-container'>
                    <div className='left-sidebar'>
                        <button onClick={() => setIsEraser(false)} className='pen-button' />
                        <button onClick={() => setIsEraser(true)} className='eraser-button' />
                        <button onClick={() => undo()} className='undo-button' />
                        <button onClick={() => redo()} className='redo-button' />
                    </div>
                </div>
                <canvas
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    ref={canvasRef}
                />
                <div className='right-sidebar-container'>
                    <div className='right-sidebar'>
                        <Sketch
                            style={{ marginTop: '1em', backgroundColor: "#323232" }}
                            color={hex}
                            disableAlpha={disableAlpha}
                            onChange={(color) => {
                                setHex(color.hex);
                            }}
                        />
                        <SliderComponent onSliderChange={handleBrushSizeChange} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SessionPage;
