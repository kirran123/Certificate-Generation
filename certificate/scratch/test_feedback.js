const axios = require('axios');

async function testFeedback() {
    try {
        const response = await axios.post('http://localhost:5000/api/feedback', {
            name: 'Test Runner',
            message: '[Test] This is a test message'
        });
        console.log('Success:', response.status, response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.status : error.message);
        if (error.response) console.error('Data:', error.response.data);
    }
}

testFeedback();
