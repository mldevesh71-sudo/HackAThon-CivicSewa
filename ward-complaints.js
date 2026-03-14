const express = require('express');

// Ward Complaints Management System
const router = express.Router();

// In-memory storage (replace with database in production)
let complaints = [];
let complaintId = 1;

// GET all complaints
router.get('/complaints', (req, res) => {
    res.json(complaints);
});

// GET complaint by ID
router.get('/complaints/:id', (req, res) => {
    const complaint = complaints.find(c => c.id === parseInt(req.params.id));
    if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
    }
    res.json(complaint);
});

// POST new complaint
router.post('/complaints', (req, res) => {
    const { wardNumber, description, category, reporterName, reporterContact } = req.body;

    if (!wardNumber || !description || !category) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const newComplaint = {
        id: complaintId++,
        wardNumber,
        description,
        category,
        reporterName,
        reporterContact,
        status: 'pending',
        createdAt: new Date()
    };

    complaints.push(newComplaint);
    res.status(201).json(newComplaint);
});

// PATCH update complaint status
router.patch('/complaints/:id', (req, res) => {
    const complaint = complaints.find(c => c.id === parseInt(req.params.id));
    if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
    }

    if (req.body.status) complaint.status = req.body.status;
    if (req.body.description) complaint.description = req.body.description;

    res.json(complaint);
});

// DELETE complaint
router.delete('/complaints/:id', (req, res) => {
    complaints = complaints.filter(c => c.id !== parseInt(req.params.id));
    res.json({ message: 'Complaint deleted' });
});

module.exports = router;