const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

const sessionSchema = new mongoose.Schema({
    data: {
        type: Buffer,
        required: true
    }
});

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
