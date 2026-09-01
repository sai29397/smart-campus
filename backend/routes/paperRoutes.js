const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const QuestionPaper = require("../models/QuestionPaper");
const { protect } = require("../middleware/authMiddleware");

const dataDir = path.join(__dirname, "../data");
const papersFilePath = path.join(dataDir, "papers.json");

// Helper to load question papers from server
function loadServerPapers() {
  try {
    if (fs.existsSync(papersFilePath)) {
      const data = fs.readFileSync(papersFilePath, "utf8");
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}

  // Default seed papers
  const defaultPapers = [
    {
      _id: "paper_101",
      id: "paper_101",
      title: "Engineering Mathematics I - End Semester Examination 2024",
      subjectName: "Engineering Mathematics I",
      subjectCode: "MA101",
      department: "Computer Science",
      year: "1st Year",
      semester: "Semester 1",
      examType: "End-Semester Exam",
      examYear: "2024",
      totalMarks: 100,
      duration: "3 Hours",
      instructions: "Answer all questions from Section A (20 Marks). Answer any 4 questions from Section B (80 Marks).",
      uploadedBy: "Dr. Sarah Jenkins",
      facultyId: "usr_faculty_1",
      createdAt: "2026-09-01T10:00:00.000Z",
      sections: [
        {
          sectionTitle: "Section A: Short Answer Questions (2 Marks Each)",
          description: "Answer all 10 questions.",
          questions: [
            { qNumber: "Q1.a", text: "State Cayley-Hamilton theorem and verify it for a 2x2 identity matrix.", marks: 2, topic: "Linear Algebra & Matrices" },
            { qNumber: "Q1.b", text: "Find the eigenvalues of matrix A = [[3, 1], [0, 2]].", marks: 2, topic: "Eigenvalues" },
            { qNumber: "Q1.c", text: "Define radius of curvature in Cartesian coordinates.", marks: 2, topic: "Differential Calculus" },
            { qNumber: "Q1.d", text: "Evaluate limit as x approaches 0 of (sin x - x) / x^3 using L'Hopital's rule.", marks: 2, topic: "Limits & Series" },
            { qNumber: "Q1.e", text: "State Euler's theorem for homogeneous functions of degree n.", marks: 2, topic: "Partial Differentiation" },
          ],
        },
        {
          sectionTitle: "Section B: Long Descriptive & Numerical Problems (20 Marks Each)",
          description: "Answer any four questions.",
          questions: [
            { qNumber: "Q2", text: "Diagonalize the matrix A = [[1, 6, 1], [1, 2, 0], [0, 0, 3]] using orthogonal transformation.", marks: 20, topic: "Orthogonal Matrix" },
            { qNumber: "Q3", text: "Find the maximum and minimum values of f(x, y, z) = x^2 + y^2 + z^2 subject to the constraint x + y + z = 1 using Lagrange's multipliers.", marks: 20, topic: "Multivariate Optimization" },
            { qNumber: "Q4", text: "Evaluate the double integral over the region bounded by y = x^2 and y = x.", marks: 20, topic: "Multiple Integrals" },
            { qNumber: "Q5", text: "Verify Stokes Theorem for the vector field F = (2x - y)i - yz^2 j - y^2 z k over the upper half of sphere x^2 + y^2 + z^2 = 1.", marks: 20, topic: "Vector Calculus" },
          ],
        },
      ],
    },
    {
      _id: "paper_102",
      id: "paper_102",
      title: "Programming in C & Data Structures - End Semester 2024",
      subjectName: "Programming in C & Data Structures",
      subjectCode: "CS102",
      department: "Computer Science",
      year: "1st Year",
      semester: "Semester 1",
      examType: "End-Semester Exam",
      examYear: "2024",
      totalMarks: 100,
      duration: "3 Hours",
      instructions: "All questions in Part A are compulsory. Answer any 5 questions from Part B.",
      uploadedBy: "Dr. Sarah Jenkins",
      facultyId: "usr_faculty_1",
      createdAt: "2026-09-01T11:30:00.000Z",
      sections: [
        {
          sectionTitle: "Part A: Core Concepts (10 x 2 = 20 Marks)",
          description: "Answer all questions.",
          questions: [
            { qNumber: "1", text: "Explain difference between pass-by-value and pass-by-reference in C using pointers.", marks: 2, topic: "Pointers" },
            { qNumber: "2", text: "What is the time complexity of searching in a Balanced Binary Search Tree (AVL Tree)?", marks: 2, topic: "Trees" },
            { qNumber: "3", text: "Differentiate between malloc() and calloc() dynamic memory functions in C.", marks: 2, topic: "Memory Management" },
            { qNumber: "4", text: "Convert infix expression ((A + B) * C - D) to Postfix expression using stack evaluation.", marks: 2, topic: "Stacks" },
          ],
        },
        {
          sectionTitle: "Part B: Algorithms & Code Implementation (16 Marks Each)",
          description: "Answer any 5 questions.",
          questions: [
            { qNumber: "5", text: "Write a complete C program to implement a Singly Linked List with insertion, deletion, and reverse operations.", marks: 16, topic: "Linked Lists" },
            { qNumber: "6", text: "Implement QuickSort algorithm in C. Explain Partition function with time complexity analysis in best, average, and worst cases.", marks: 16, topic: "Sorting Algorithms" },
            { qNumber: "7", text: "Explain Breadth First Search (BFS) and Depth First Search (DFS) graph traversal with examples and queue/stack state representations.", marks: 16, topic: "Graph Algorithms" },
          ],
        },
      ],
    },
    {
      _id: "paper_201",
      id: "paper_201",
      title: "Object-Oriented Programming (Java) - End Semester 2024",
      subjectName: "Object-Oriented Programming (Java)",
      subjectCode: "CS201",
      department: "Computer Science",
      year: "2nd Year",
      semester: "Semester 3",
      examType: "End-Semester Exam",
      examYear: "2024",
      totalMarks: 100,
      duration: "3 Hours",
      instructions: "Answer all questions. Show code snippets clearly.",
      uploadedBy: "Dr. Sarah Jenkins",
      facultyId: "usr_faculty_1",
      createdAt: "2026-09-01T12:00:00.000Z",
      sections: [
        {
          sectionTitle: "Section A: OOP Fundamentals & JVM Architecture",
          description: "20 Marks Total",
          questions: [
            { qNumber: "Q1", text: "Explain the four pillars of OOP (Encapsulation, Inheritance, Polymorphism, Abstraction) in Java with code snippets.", marks: 10, topic: "OOP Concepts" },
            { qNumber: "Q2", text: "Explain Java Garbage Collection mechanisms and finalize() method lifecycle.", marks: 10, topic: "JVM & Memory" },
          ],
        },
        {
          sectionTitle: "Section B: Multithreading & Exception Handling",
          description: "80 Marks Total",
          questions: [
            { qNumber: "Q3", text: "Write a Java program demonstrating Producer-Consumer problem using inter-thread communication (wait, notify, and notifyAll).", marks: 20, topic: "Multithreading" },
            { qNumber: "Q4", text: "Design a custom banking Exception `InsufficientFundsException` and handle it with try-catch-finally blocks.", marks: 20, topic: "Exception Handling" },
          ],
        },
      ],
    },
    {
      _id: "paper_301",
      id: "paper_301",
      title: "Machine Learning & Deep Neural Nets - End Semester 2024",
      subjectName: "Machine Learning & Deep Neural Nets",
      subjectCode: "CSML301",
      department: "Computer Science",
      year: "3rd Year",
      semester: "Semester 5",
      examType: "End-Semester Exam",
      examYear: "2024",
      totalMarks: 100,
      duration: "3 Hours",
      instructions: "Scientific calculators are permitted. Show intermediate gradient calculations.",
      uploadedBy: "Dr. Sarah Jenkins",
      facultyId: "usr_faculty_1",
      createdAt: "2026-09-01T13:00:00.000Z",
      sections: [
        {
          sectionTitle: "Part 1: Supervised Learning & Optimization (40 Marks)",
          description: "Core algorithms and loss formulation",
          questions: [
            { qNumber: "1", text: "Derive the gradient update rule for Linear Regression with L2 Regularization (Ridge Regression). Explain bias-variance tradeoff.", marks: 20, topic: "Regularization" },
            { qNumber: "2", text: "Explain Support Vector Machines (SVM) maximum margin formulation with soft-margin slack variables and kernel trick (RBF kernel).", marks: 20, topic: "SVM" },
          ],
        },
        {
          sectionTitle: "Part 2: Deep Learning Architectures (60 Marks)",
          description: "Neural Networks and Computer Vision",
          questions: [
            { qNumber: "3", text: "Derive Backpropagation equations for a 3-layer Multilayer Perceptron with Cross-Entropy loss and Softmax activation.", marks: 20, topic: "Backpropagation" },
            { qNumber: "4", text: "Explain Convolutional Neural Networks (CNN): Convolution layer, Stride, Padding, Pooling, and Feature Maps.", marks: 20, topic: "CNN Architecture" },
            { qNumber: "5", text: "Compare Dropout, Batch Normalization, and Early Stopping techniques for preventing overfitting in Deep Neural Networks.", marks: 20, topic: "Optimization Techniques" },
          ],
        },
      ],
    },
    {
      _id: "paper_302",
      id: "paper_302",
      title: "Advanced Cloud Architecture & DevOps - End Semester 2024",
      subjectName: "Advanced Cloud Arch",
      subjectCode: "CSCC307",
      department: "Computer Science",
      year: "3rd Year",
      semester: "Semester 6",
      examType: "End-Semester Exam",
      examYear: "2024",
      totalMarks: 100,
      duration: "3 Hours",
      instructions: "Answer all sections.",
      uploadedBy: "Dr. Sarah Jenkins",
      facultyId: "usr_faculty_1",
      createdAt: "2026-09-01T14:00:00.000Z",
      sections: [
        {
          sectionTitle: "Section 1: Cloud Infrastructure & Virtualization",
          description: "50 Marks",
          questions: [
            { qNumber: "1", text: "Compare Monolithic Architecture vs Microservices Architecture in Cloud. Detail API Gateway, Service Discovery, and Circuit Breaker patterns.", marks: 25, topic: "Microservices" },
            { qNumber: "2", text: "Explain Kubernetes Architecture: Control Plane (API Server, Etcd, Controller Manager, Scheduler) and Worker Nodes (Kubelet, Kube-Proxy, Container Runtime).", marks: 25, topic: "Container Orchestration" },
          ],
        },
        {
          sectionTitle: "Section 2: High Availability & CI/CD Pipelines",
          description: "50 Marks",
          questions: [
            { qNumber: "3", text: "Design a fault-tolerant multi-region cloud deployment on AWS/GCP with Auto Scaling, Load Balancer, and Read Replicas database.", marks: 25, topic: "Cloud Design Patterns" },
            { qNumber: "4", text: "Construct a complete CI/CD pipeline using GitHub Actions / Jenkins with automated linting, unit testing, Docker containerization, and blue-green deployment.", marks: 25, topic: "DevOps CI/CD" },
          ],
        },
      ],
    },
  ];

  saveServerPapers(defaultPapers);
  return defaultPapers;
}

function saveServerPapers(list) {
  try {
    fs.writeFileSync(papersFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {}
}

let inMemoryPapers = loadServerPapers();

// ==========================================================================
// 1. GET ALL / FILTERED QUESTION PAPERS (Accessible to all students & faculty)
// ==========================================================================
router.get("/", protect, (req, res) => {
  try {
    const { year, department, subject, examType, examYear, search } = req.query;
    inMemoryPapers = loadServerPapers();

    let filtered = inMemoryPapers;

    if (year && year !== "All Years") {
      filtered = filtered.filter((p) => (p.year || "").toLowerCase() === year.toLowerCase());
    }

    if (department && department !== "All Departments") {
      filtered = filtered.filter((p) => (p.department || "").toLowerCase() === department.toLowerCase());
    }

    if (examType && examType !== "All Exam Types") {
      filtered = filtered.filter((p) => (p.examType || "").toLowerCase() === examType.toLowerCase());
    }

    if (examYear && examYear !== "All Years") {
      filtered = filtered.filter((p) => String(p.examYear) === String(examYear));
    }

    if (subject) {
      filtered = filtered.filter(
        (p) =>
          p.subjectName.toLowerCase().includes(subject.toLowerCase()) ||
          p.subjectCode.toLowerCase().includes(subject.toLowerCase())
      );
    }

    if (search) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.subjectName.toLowerCase().includes(q) ||
          p.subjectCode.toLowerCase().includes(q) ||
          p.examType.toLowerCase().includes(q) ||
          String(p.examYear).includes(q)
      );
    }

    return res.json({
      success: true,
      count: filtered.length,
      papers: filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    });
  } catch (error) {
    console.error("Get Papers Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch question papers." });
  }
});

// ==========================================================================
// 2. GET SINGLE PAPER DETAILS
// ==========================================================================
router.get("/:id", protect, (req, res) => {
  try {
    const { id } = req.params;
    inMemoryPapers = loadServerPapers();

    const paper = inMemoryPapers.find((p) => p._id === id || p.id === id);
    if (!paper) {
      return res.status(404).json({ success: false, message: "Question paper not found." });
    }

    // Increment download/view count
    paper.downloadsCount = (paper.downloadsCount || 0) + 1;
    saveServerPapers(inMemoryPapers);

    return res.json({ success: true, paper });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load paper." });
  }
});

// ==========================================================================
// 3. UPLOAD / PUBLISH NEW QUESTION PAPER (Faculty / Admin)
// ==========================================================================
router.post("/", protect, async (req, res) => {
  try {
    const {
      title,
      subjectName,
      subjectCode,
      department,
      year,
      semester,
      examType,
      examYear,
      totalMarks,
      duration,
      instructions,
      sections,
      fileUrl,
    } = req.body;

    if (!title || !subjectName || !subjectCode || !year) {
      return res.status(400).json({
        success: false,
        message: "Title, Subject Name, Subject Code, and Academic Year are required.",
      });
    }

    const facultyId = String(req.user._id || req.user.id);
    const uploadedBy = req.user.name || "Faculty Member";

    const newPaper = {
      _id: "paper_" + Date.now(),
      id: "paper_" + Date.now(),
      title: title.trim(),
      subjectName: subjectName.trim(),
      subjectCode: subjectCode.trim().toUpperCase(),
      department: department || req.user.department || "Computer Science",
      year: year.trim(),
      semester: semester || "Semester 1",
      examType: examType || "End-Semester Exam",
      examYear: String(examYear || new Date().getFullYear()),
      totalMarks: Number(totalMarks) || 100,
      duration: duration || "3 Hours",
      instructions: instructions || "Answer all questions according to instructions.",
      sections: Array.isArray(sections) && sections.length > 0 ? sections : [
        {
          sectionTitle: "Section A: Theory & Numerical Questions",
          description: "Answer all questions.",
          questions: [
            { qNumber: "Q1", text: "Explain core principles and syllabus definitions.", marks: 20, topic: "Core Theory" },
            { qNumber: "Q2", text: "Solve detailed design and computational problem.", marks: 30, topic: "Design & Implementation" },
          ],
        },
      ],
      fileUrl: fileUrl || "",
      uploadedBy,
      facultyId,
      downloadsCount: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      const dbPaper = await QuestionPaper.create(newPaper);
      newPaper._id = dbPaper._id.toString();
    } catch (dbErr) {}

    inMemoryPapers = loadServerPapers();
    inMemoryPapers.unshift(newPaper);
    saveServerPapers(inMemoryPapers);

    return res.status(201).json({
      success: true,
      message: `Question paper "${title}" published successfully for ${year}!`,
      paper: newPaper,
    });
  } catch (error) {
    console.error("Create Paper Error:", error);
    res.status(500).json({ success: false, message: "Server error while saving question paper." });
  }
});

// ==========================================================================
// 4. DELETE QUESTION PAPER
// ==========================================================================
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryPapers = loadServerPapers();

    const initialLen = inMemoryPapers.length;
    inMemoryPapers = inMemoryPapers.filter((p) => p._id !== id && p.id !== id);

    if (inMemoryPapers.length === initialLen) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    saveServerPapers(inMemoryPapers);

    try {
      await QuestionPaper.findByIdAndDelete(id);
    } catch (e) {}

    return res.json({ success: true, message: "Question paper deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete question paper." });
  }
});

module.exports = router;
