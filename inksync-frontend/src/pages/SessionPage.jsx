import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams } from "react-router-dom";
import Sketch from '@uiw/react-color-sketch';
import './css/SessionPage.css';
import SliderComponent from '../components/Slider';

function SessionPage() {
    const { id } = useParams();
    const [users, setUsers] = useState([]);
    const [data, setData] = useState();
    const [localCoords, setLocalCoords] = useState({ x: 0, y: 0 });
    const [lastCoords, setLastCoords] = useState({ x: 0, y: 0 });
    const [loadingTime, setLoadingTime] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState();
    const [brushSize, setBrushSize] = useState(1);
    const [isEraser, setIsEraser] = useState(false);
    const [hex, setHex] = useState("#fff");
    const [disableAlpha, setDisableAlpha] = useState(true);
    const canvasRef = useRef(null);

    const handleMouseDown = () => {
        setIsDrawing(true);  // Start drawing
    };

    const handleMouseUp = () => {
        setIsDrawing(false);  // Stop drawing
    };

    const handleMouseMove = event => {
        // Get the position of the canvas relative to the viewport
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const newCoords = {
            x: (event.clientX - rect.left) * scaleX, // Scale mouse X to canvas coordinates
            y: (event.clientY - rect.top) * scaleY,  // Scale mouse Y to canvas coordinates
        };
        setLocalCoords(newCoords);

        // If the user is drawing, modify the image
        if (isDrawing) {
            modifyImage(lastCoords.x, lastCoords.y, newCoords.x, newCoords.y);
        }
    };

    const modifyImage = (startX, startY, endX, endY) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = isEraser ? `rgb(255, 255, 255)` : changeColor(); // Pixel color

        // Draw between the two points
        ctx.beginPath();
        ctx.moveTo(startX, startY);  // Move to the start point
        ctx.lineTo(endX, endY);  // Draw to the end point
        ctx.lineCap = "round";
        ctx.lineWidth = brushSize;
        ctx.stroke();  // Apply the line

        // Update lastCoords to the current mouse position
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
        return `rgb(${red}, ${green}, ${blue})`
    }

    const handleBrushSizeChange = (value) => {
        setBrushSize(value);
    }

    const arrayToImage = () => {
        if (!data || data.length === 0 || data[0].length === 0) {
            return;
        }

        // const startTime = performance.now();

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

        // const endTime = performance.now();
        // const loadTime = endTime - startTime;
        // setLoadingTime(loadTime);
    };

    useEffect(() => {
        axios.get(`http://localhost:8080/sessions/${id}`)
            .then(response => {
                // setUsers(response.data.users);
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
        <div className='session-page-container'>
            {/* {loadingTime !== null && (
                <h3>Canvas render time: {loadingTime.toFixed(2)} ms</h3>
            )} */}
            <div className='body-container'>
                <div className='left-sidebar-container'>
                    <div className='left-sidebar'>
                        <button
                            onClick={() => alert('Button clicked')}
                            style={{
                                backgroundImage: `url(/Cursor.svg)`,
                                backgroundSize: 'cover',
                                backgroundRepeat: 'no-repeat',
                                width: '3em',
                                height: '3em',
                                cursor: 'pointer',
                                marginTop: '1em'
                            }}
                        />
                        <button
                            onClick={() => setIsEraser(false)}
                            style={{
                                backgroundImage: `url(/Paintbrush.svg)`,
                                backgroundSize: 'cover',
                                backgroundRepeat: 'no-repeat',
                                width: '3em',
                                height: '3em',
                                cursor: 'pointer',
                                marginTop: '1em'
                            }}
                        />
                        <button
                            onClick={() => setIsEraser(true)}
                            style={{
                                backgroundImage: `url(/Erase.svg)`,
                                backgroundSize: 'cover',
                                backgroundRepeat: 'no-repeat',
                                width: '3em',
                                height: '3em',
                                cursor: 'pointer',
                                marginTop: '1em'
                            }}
                        />
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
                            style={{ marginTop: '1em', backgroundColor: "#323232", boxShadow: null }}
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
