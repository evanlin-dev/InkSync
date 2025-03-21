import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams } from "react-router-dom";
import Sketch from '@uiw/react-color-sketch';
import './css/SessionPage.css';
import SliderComponent from '../components/Slider';
import { useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook'
import {
    Paintbrush,
    Eraser,
    RotateCcw,
    RotateCw,
    Trash2,
    ChevronDown,
    Square,
    Circle,
    Triangle,
    Hexagon,
    PaintBucket,
    Eye,
    EyeOff,
    Plus,
    Users,
    Crown,
    Download
} from "lucide-react";

function SessionPage() {
    const { id } = useParams();
    const [data, setData] = useState();
    const [users, setUsers] = useState();
    const [localCoords, setLocalCoords] = useState({ x: 0, y: 0 });
    const [lastCoords, setLastCoords] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(1);
    const [isEraser, setIsEraser] = useState(false);
    const [hex, setHex] = useState("#000");
    const [disableAlpha, setDisableAlpha] = useState(true);
    const [editingLayerId, setEditingLayerId] = useState(null);
    const [editingLayerName, setEditingLayerName] = useState('');
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const [commandStack, setCommandStack] = useState([]);
    const currentCommandRef = useRef(null);
    const [userCommandPointers, setUserCommandPointers] = useState({});
    // Store background ImageData for efficient canvas redrawing
    const [backgroundImageData, setBackgroundImageData] = useState(null);
    const { state } = useLocation();
    const userIndex = state?.userIndex;

    const [showUsersDropdown, setShowUsersDropdown] = useState(false);
    const [currentTool, setCurrentTool] = useState('brush');
    const [showShapeMenu, setShowShapeMenu] = useState(false);
    const [selectedShape, setSelectedShape] = useState('square');
    const shapeButtonRef = useRef(null);

    // Add these new state hooks near your other state declarations
    const [shapeStartCoords, setShapeStartCoords] = useState({ x: 0, y: 0 });
    const [shapePreview, setShapePreview] = useState(null);
    const [isDrawingShape, setIsDrawingShape] = useState(false);

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
                console.log("Received websocket data:", receivedData);

                if (receivedData.action === 'sync') {
                    // Update the command stack and pointers from server
                    setCommandStack(receivedData.stack);
                    setUserCommandPointers(receivedData.pointerMap);
                    redrawCanvas(receivedData.stack, receivedData.pointerMap);
                }
                else if (receivedData.action === 'undoOperation' || receivedData.action === 'redoOperation') {
                    // Handle specific undo/redo operations
                    console.log(`Received ${receivedData.action} for user ${receivedData.userIndex}`);
                    // No need to do anything here as we'll receive a sync message right after
                }
                else if (receivedData.lastCoords && receivedData.newCoords) {
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
                }
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
                setUsers(response.data.users);
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

    useHotkeys('ctrl+z', () => undo(), [])
    // Function to undo the last action
    const undo = () => {
        if (userIndex !== undefined) {
            socketRef.current.send(JSON.stringify({
                action: 'undo',
                userIndex: userIndex
            }));
        }
    };

    useHotkeys('ctrl+y', () => redo(), [])
    // Function to redo the undone action
    const redo = () => {
        if (userIndex !== undefined) {
            socketRef.current.send(JSON.stringify({
                action: 'redo',
                userIndex: userIndex
            }));
        }
    };

    // Complete canvas redraw function - rebuilds entire canvas from command history
    const redrawCanvas = (stack = commandStack, pointerMap = userCommandPointers) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Clear the entire canvas - necessary because Canvas API is immediate-mode
        // and has no built-in concept of layers or history
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Reapply the background ImageData first
        // This is critical because:
        // 1. Canvas is stateless between redraws - clearRect wipes everything
        // 2. We need a consistent starting point before drawing commands
        // 3. This maintains the initial canvas state (usually white background)
        if (backgroundImageData) {
            ctx.putImageData(backgroundImageData, 0, 0);
        }

        // Draw all active strokes in the stack
        // We're rebuilding the entire visual state from our command objects
        // This enables non-destructive editing (undo/redo) without data loss
        stack.forEach(command => {
            // Skip inactive commands (those that were undone)
            if (!command.active) return;

            if (command.type === 'background') {
                // Handle background image drawing
                // Note: actual ImageData isn't stored in commands that go to server
                // as it would be too large for efficient transmission
                if (command.imageData) {
                    ctx.putImageData(command.imageData, 0, 0);
                }
            } else if (command.type === 'stroke') {
                // Draw stroke commands using their vector data
                ctx.globalCompositeOperation = command.isEraser ? 'destination-out' : 'source-over';

                ctx.strokeStyle = command.isEraser ? 'rgba(0,0,0,1)' : command.color;
                ctx.lineWidth = command.brushSize;
                ctx.lineCap = 'round';

                command.segments.forEach(segment => {
                    ctx.beginPath();
                    ctx.moveTo(segment.startX, segment.startY);
                    ctx.lineTo(segment.endX, segment.endY);
                    ctx.stroke();
                });

                ctx.globalCompositeOperation = 'source-over';
            } else if (command.type === 'shape') {
                // Draw shape commands
                drawShape(
                    command.startX,
                    command.startY,
                    command.endX,
                    command.endY,
                    command.shapeType,
                    command.isEraser ? 'rgba(0,0,0,1)' : command.color,
                    command.brushSize,
                    false // Not a preview
                );
            }
        });
    };
    // Update the canvas when command stack or pointers change
    useEffect(() => {
        redrawCanvas();
    }, [commandStack, userCommandPointers]);

    // Vector-based command storage for a drawing operation
    // This approach dramatically reduces network traffic compared to sending pixel data
    // A bitmap approach would require sending the entire canvas state (potentially millions of pixels)
    // Our vector approach only sends the essential drawing instructions (a few coordinates per stroke)
    const handleMouseDown = (event) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const newCoords = {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };

        setLastCoords(newCoords);

        if (currentTool === 'shape') {
            // For shapes, we just record the starting position and wait for mouse up
            setShapeStartCoords(newCoords);
            setIsDrawingShape(true);

            // Create a temporary canvas for shape preview if not already created
            if (!shapePreview) {
                const preview = document.createElement('canvas');
                preview.width = canvasRef.current.width;
                preview.height = canvasRef.current.height;
                setShapePreview(preview);
            }
        } else {
            setIsDrawing(true);

            // Create a new vector-based stroke command
            // Instead of sending pixel data (bitmap approach), we store:
            // 1. The start/end points of each line segment
            // 2. Style information (color, brush size, etc.)
            // 3. Type information (stroke vs eraser)
            //
            // Benefits:
            // - Network efficiency: Sending coordinates uses far less bandwidth than pixel data
            // - Scalability: Vector commands work at any resolution
            // - Editability: Each stroke can be individually manipulated (undo/redo)
            currentCommandRef.current = {
                type: 'stroke',
                segments: [], // Will contain vector coordinates, not pixel data
                color: changeColor(),
                brushSize: brushSize,
                isEraser: isEraser,
                userIndex: userIndex
            };
        }
    };


    const handleMouseUp = (event) => {
        if (isDrawingShape) {
            setIsDrawingShape(false);

            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = canvasRef.current.width / rect.width;
            const scaleY = canvasRef.current.height / rect.height;

            const endCoords = {
                x: (event.clientX - rect.left) * scaleX,
                y: (event.clientY - rect.top) * scaleY,
            };

            // Draw the final shape on the main canvas
            drawShape(
                shapeStartCoords.x,
                shapeStartCoords.y,
                endCoords.x,
                endCoords.y,
                selectedShape,
                isEraser ? 'rgba(0,0,0,0)' : changeColor(),
                brushSize,
                false // preview = false means this is the final shape
            );

            // Create a shape command and send it to the server
            const shapeCommand = {
                type: 'shape',
                shapeType: selectedShape,
                startX: shapeStartCoords.x,
                startY: shapeStartCoords.y,
                endX: endCoords.x,
                endY: endCoords.y,
                color: isEraser ? '#00000000' : hex,
                brushSize: brushSize,
                isEraser: isEraser,
                userIndex: userIndex,
                active: true
            };

            // Send the shape command to the server
            socketRef.current.send(JSON.stringify({
                action: 'draw',
                command: shapeCommand,
                userIndex: userIndex
            }));
        } else {
            setIsDrawing(false);  // Stop drawing
            if (currentCommandRef.current) {
                const temp = currentCommandRef.current;

                // Send the drawing command to the backend via WebSocket
                socketRef.current.send(JSON.stringify({
                    action: 'draw',
                    command: temp,
                    userIndex: userIndex
                }));

                currentCommandRef.current = null;
            }
        }
    };

    // Add stroke segments as vectors during mouse movement
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

        // Handle shape preview while dragging
        if (isDrawingShape && currentTool === 'shape') {
            // Clear the preview canvas and draw the shape preview
            if (shapePreview) {
                const previewCtx = shapePreview.getContext('2d');
                previewCtx.clearRect(0, 0, shapePreview.width, shapePreview.height);

                // Draw the shape on the preview canvas
                drawShape(
                    shapeStartCoords.x,
                    shapeStartCoords.y,
                    newCoords.x,
                    newCoords.y,
                    selectedShape,
                    isEraser ? 'rgba(0,0,0,0)' : changeColor(),
                    brushSize,
                    true // preview = true
                );

                // Draw the preview on the main canvas
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');

                // First redraw the canvas to clear previous preview
                redrawCanvas();

                // Then draw the preview
                ctx.drawImage(shapePreview, 0, 0);
            }
        }
        // If the user is drawing with brush, add a new vector segment
        else if (isDrawing) {
            // Send minimal vector data to other clients
            socketRef.current.send(JSON.stringify({
                lastCoords,
                newCoords,
                hex: isEraser ? '#00000000' : hex,
                brushSize,
                isEraser
            }));

            // Record the current segment as vector data
            // This stores just two points (start/end) rather than all affected pixels
            // A 100-pixel line would be just 4 numbers (2 coordinates) instead of 100+ pixel values
            if (currentCommandRef.current) {
                currentCommandRef.current.segments.push({
                    startX: lastCoords.x,
                    startY: lastCoords.y,
                    endX: newCoords.x,
                    endY: newCoords.y
                });
            }

            // Draw the line on the local canvas
            modifyImage(
                lastCoords.x,
                lastCoords.y,
                newCoords.x,
                newCoords.y,
                isEraser ? 'rgba(0,0,0,0)' : changeColor(),
                brushSize,
                isEraser
            );
        }
    };

    // Add the drawShape function to handle different shape types
    const drawShape = (startX, startY, endX, endY, shapeType, color, size, isPreview) => {
        const canvas = isPreview ? shapePreview : canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set drawing properties
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
        ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : color;
        ctx.lineWidth = size;

        // Calculate dimensions
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        const topLeftX = Math.min(startX, endX);
        const topLeftY = Math.min(startY, endY);

        ctx.beginPath();

        // Draw the appropriate shape
        switch (shapeType) {
            case 'square':
                ctx.rect(topLeftX, topLeftY, width, height);
                break;
            case 'circle':
                // For a circle, we use the center point and radius
                const centerX = (startX + endX) / 2;
                const centerY = (startY + endY) / 2;
                const radius = Math.max(width, height) / 2;
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                break;
            case 'triangle':
                // Draw an equilateral triangle
                ctx.moveTo(startX, endY);
                ctx.lineTo(endX, endY);
                ctx.lineTo((startX + endX) / 2, startY);
                ctx.closePath();
                break;
            case 'hexagon':
                // Draw a hexagon centered at the midpoint
                const hexCenterX = (startX + endX) / 2;
                const hexCenterY = (startY + endY) / 2;
                const hexRadius = Math.max(width, height) / 2;

                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const x = hexCenterX + hexRadius * Math.cos(angle);
                    const y = hexCenterY + hexRadius * Math.sin(angle);

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                break;
            default:
                break;
        }

        // Draw outline or filled shape based on preference
        // You could make this a user setting later
        ctx.stroke(); // For just the outline
        // ctx.fill(); // Uncomment for filled shapes
    };

    const modifyImage = (startX, startY, endX, endY, color, size, eraser) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';

        ctx.strokeStyle = eraser ? 'rgba(0,0,0,1)' : color;
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

        // Store the background image data
        setBackgroundImageData(imgData);

        // Draw the background
        ctx.putImageData(imgData, 0, 0);

        // Add background change to the server as a command
        socketRef.current.send(JSON.stringify({
            action: 'draw',
            command: {
                type: 'background',
                imageData: null, // We can't send the actual ImageData over WebSocket
                userIndex: userIndex
            },
            userIndex: userIndex
        }));
    };

    // Toggle users dropdown
    const toggleUsersDropdown = () => {
        setShowUsersDropdown(!showUsersDropdown);
    };

    // Handle shape selection
    const handleShapeSelect = (shape) => {
        setSelectedShape(shape);
        setCurrentTool('shape');
        setShowShapeMenu(false);
    };

    // Render shape icon based on selection
    const renderSelectedShapeIcon = () => {
        switch (selectedShape) {
            case 'square': return <Square size={24} color="white" />;
            case 'circle': return <Circle size={24} color="white" />;
            case 'triangle': return <Triangle size={24} color="white" />;
            case 'hexagon': return <Hexagon size={24} color="white" />;
            default: return <Square size={24} color="white" />;
        }
    };

    return (
        <div className='session-page-container'>
            <div className='history-controls'>
                <button onClick={() => undo()} className='tool-button undo-button'>
                    <RotateCcw size={24} color="white" />
                </button>
                <button onClick={() => redo()} className='tool-button redo-button'>
                    <RotateCw size={24} color="white" />
                </button>
                <div className="users-dropdown">
                    <button onClick={toggleUsersDropdown} className="users-dropdown-button">
                        <Users size={24} color="white" />
                    </button>
                    <div className={`users-dropdown-content ${showUsersDropdown ? 'show' : ''}`}>
                        {users && users.map((user, index) => (
                            <a
                                key={index}
                                href="#"
                                className={index === userIndex ? 'current-user' : ''}
                                onClick={(e) => e.preventDefault()}
                            >
                                {index === 0 && <Crown size={14} color="gold" className="admin-crown" />}
                                {user} {index === userIndex ? '(you)' : ''}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
            <div className='body-container'>
                <div className='left-sidebar-container'>
                    <div className='left-sidebar'>
                        <button
                            onClick={() => { setIsEraser(false); setCurrentTool('brush'); }}
                            className={`tool-button ${currentTool === 'brush' && !isEraser ? 'active' : ''}`}>
                            <Paintbrush size={24} color="white" />
                        </button>
                        <button
                            onClick={() => { setIsEraser(true); setCurrentTool('eraser'); }}
                            className={`tool-button ${currentTool === 'eraser' || isEraser ? 'active' : ''}`}>
                            <Eraser size={24} color="white" />
                        </button>
                        <button
                            ref={shapeButtonRef}
                            onClick={() => { setShowShapeMenu(!showShapeMenu); }}
                            className={`tool-button ${currentTool === 'shape' ? 'active' : ''}`}
                            style={{ position: 'relative' }}>
                            {renderSelectedShapeIcon()}
                            {showShapeMenu && (
                                <div className="shape-menu">
                                    <div className="shape-option" onClick={() => handleShapeSelect('square')}>
                                        <Square size={24} color="white" />
                                    </div>
                                    <div className="shape-option" onClick={() => handleShapeSelect('circle')}>
                                        <Circle size={24} color="white" />
                                    </div>
                                    <div className="shape-option" onClick={() => handleShapeSelect('triangle')}>
                                        <Triangle size={24} color="white" />
                                    </div>
                                    <div className="shape-option" onClick={() => handleShapeSelect('hexagon')}>
                                        <Hexagon size={24} color="white" />
                                    </div>
                                </div>
                            )}
                        </button>
                    </div>
                </div>
                <div className='canvas-container'>
                    <canvas
                        onMouseMove={handleMouseMove}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        ref={canvasRef}
                    />
                </div>
                <div className='right-sidebar-container'>
                    <div className='right-sidebar'>
                        <div className="color-picker-container">
                            <Sketch
                                style={{ width: '100%', backgroundColor: "transparent" }}
                                color={hex}
                                disableAlpha={disableAlpha}
                                onChange={(color) => {
                                    setHex(color.hex);
                                }}
                            />
                        </div>
                        <div className="slider-container">
                            <SliderComponent onSliderChange={handleBrushSizeChange} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SessionPage;