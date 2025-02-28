import React, { useState } from 'react';
import './css/Slider.css';

function SliderComponent({ onSliderChange }) {
    const [sliderValue, setSliderValue] = useState(1);

    // Handle range slider changes
    const handleSliderChange = (e) => {
        const value = Number(e.target.value);
        setSliderValue(value);
        onSliderChange(value);
    };

    // Handle number input changes
    const handleNumberChange = (e) => {
        const value = Number(e.target.value);
        setSliderValue(value);
        onSliderChange(value);
    };

    return (
        <div className='slider-container'>
            <input
                type='range'
                value={sliderValue}
                onChange={handleSliderChange}
                min={1}
                max={100}
            />
            <input
                type='number'
                value={sliderValue}
                onChange={handleNumberChange}
                min={1}
                max={100}
            />
        </div>
    );
}

export default SliderComponent;
