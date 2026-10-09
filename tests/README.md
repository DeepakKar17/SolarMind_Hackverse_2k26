# SolarMind Test Suite

This directory contains test strategies, contract validations, and end-to-end integration specifications.

## Structure
- `backend/`: Pytest tests for API routes, physics yield models, fault classifiers, and computer vision modules.
- `frontend/`: Vitest + React Testing Library tests for UI components, charts, and API client interceptors.

## Running Tests

### Backend Unit & Integration Tests
```bash
cd backend
pytest
```

### Frontend Unit & Component Tests
```bash
cd frontend
npm run test
```
