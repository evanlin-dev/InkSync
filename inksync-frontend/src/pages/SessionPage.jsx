import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from "react-router-dom";
import './css/SessionPage.css';

function SessionPage() {
    const { id } = useParams();
    const [users, setUsers] = useState([]);
    useEffect(() => {
        axios.get(`http://localhost:8080/sessions/${id}`)
            .then(response => {
                console.log(response.data)
                setUsers(response.data.users);
            })
            .catch(error => {
                console.error('Error fetching sessions:', error);
            });
    }, []);
    return (
        <div className="session-page">
            <h1>Welcome to the Session Page</h1>
            <h1>Session ID: {id}</h1>
            <ul>
                {users.map(user => (
                    <li>
                        {user}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default SessionPage;
