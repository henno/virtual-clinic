const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yaml');
const {v4: uuidv4} = require('uuid');

require('dotenv').config();

const port = process.env.PORT || 3000;

let sessions = [
    {id: "1", userId: 1} // Do not use in production
];

let users = [
    {id: 1, email: 'admin@admin.com', password: 'admin'} // Do not use in production
];
let consultations = [
    {id: "some-id", userId: 1, date: '2021-01-01', issue: 'Headache'} // Do not use in production
]
// Serve static files
app.use(express.static('public'));

// Use the Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middleware to parse JSON
app.use(express.json());

// General error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.statusCode || 500;
    res.status(status).send(err.message);
})

// Routes
app.post('/sessions', (req, res) => {
    // Validate email and password
    if (!req.body.email || !req.body.password) {
        return res.status(400).send('Email and password are required')
    }
    // Get user
    const user = users.find(user => user.email === req.body.email)
    if (!user) {
        return res.status(400).send('User not found')
    }
    // Check password
    if (user.password !== req.body.password) {
        return res.status(400).send('Invalid password')
    }

    // If valid, create a session
    const session = {
        id: uuidv4(),
        userId: user.id,
        createdAt: new Date()
    }

    // Add session to sessions array
    sessions.push(session)

    // Return a new session
    res.status(201).send({sessionId: session.id})
})

function authenticateRequest(req, res, next) {

    // Check for authorization header
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send('Authorization header is required')
    }

    // Check Authorization header format
    const authHeaderParts = authHeader.split(' ')
    if (authHeaderParts.length !== 2 || authHeaderParts[0] !== 'Bearer') {
        return res.status(401).send('Authorization header format must be "Bearer {token}"')
    }

    // Get session ID from header
    const sessionId = authHeaderParts[1]

    // Validate session ID
    if (!sessionId) {
        return res.status(401).send('Session ID is required')
    }

    // Get session
    const session = sessions.find(session => session.id === sessionId)

    // If session not found, return 401
    if (!session) {
        return res.status(401).send('Invalid session')
    }

    // Get user
    const user = users.find(user => user.id === session.userId)

    // Validate user
    if (!user) {
        return res.status(401).send('User not found')
    }

    // Add session to request
    req.session = session

    // Add user to request
    req.user = user

    // Continue processing the request
    next()
}

app.delete('/sessions', authenticateRequest, (req, res) => {

    // Remove session from sessions array
    sessions = sessions.filter(session => session.id !== req.session.id)

    // Return a 204 with no content if the session was deleted
    res.status(204).send()
})

app.post('/users', (req, res) => {
    // Validate that the user does not already exist
    const existingUser = users.find(user => user.email === req.body.email)
    if (existingUser) {
        return res.status(409).send('User already exists')
    }

    // Return 400 if email or password is missing
    if (!req.body.email || !req.body.password) {
        return res.status(400).send('Email and password are required')
    }

    // Return 400 if email is not in correct format or password is less than 8 chars
    if (!req.body.email.includes('@') || req.body.password.length < 8) {
        return res.status(400).send('Email must be in correct format and password must be at least 8 characters')
    }

    // Create user
    const user = {
        id: uuidv4(),
        email: req.body.email,
        password: req.body.password
    }

    // Add user to users array
    users.push(user)

    // Return 201 Created
    res.status(201).send()

})

function getConsultations(userId) {
    return consultations.filter(consultation => consultation.userId === userId)
}

app.get('/consultations', authenticateRequest, (req, res) => {
    // Get consultations for the user
    const consultations = getConsultations(req.user.id)

    // Return a list of consultations
    res.send(consultations)
})

function getFormattedDate(date) {

    date = date ? new Date(date) : new Date();

    return `${date.getFullYear()}-${(date.getMonth() + 1).toString()
        .padStart(2, '0')}-${date.getDate().toString()
        .padStart(2, '0')} ${date.getHours().toString()
        .padStart(2, '0')}:${date.getMinutes().toString()
        .padStart(2, '0')}`;
}

app.post('/consultations', authenticateRequest, (req, res) => {
    // Return 400 if issue parameter is missing
    if (!req.body.issue) {
        return res.status(400).send('Issue is required')
    }

    // Create YYYY-MM-DD HH:II formatted date with months and days with leading zeros
    // Create consultation for the user
    const consultation = {
        id: uuidv4(),
        userId: req.user.id,
        date: getFormattedDate(),
        issue: req.body.issue
    }

    // Add consultation to consultations array
    consultations.push(consultation)

    // Return 201 Created
    res.status(201).send(consultation)
})

app.patch('/consultations/:id', authenticateRequest, (req, res) => {

    // Return 400 if issue parameter is missing
    if (!req.body.issue) {
        return res.status(400).send('Issue is required')
    }

    // Get consultation
    const consultation = consultations.find(consultation => consultation.id === req.params.id)

    // Return 404 if consultation not found
    if (!consultation) {
        return res.status(404).send('Consultation not found')
    }

    // Return 403 if consultation does not belong to the user
    if (consultation.userId !== req.user.id) {
        return res.status(403).send('Consultation does not belong to the user')
    }

    // Add the consultation edit date
    consultation.editedAt = getFormattedDate()

    // Update consultation
    consultation.issue = req.body.issue

    // Return 204 No Content
    res.status(204).send()
})

app.listen(port, () => {
    console.log(`App running. Docs at http://localhost:${port}/docs`);
})
