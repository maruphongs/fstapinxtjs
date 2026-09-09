from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="FastAPI Backend")

# Allow requests from the Next.js development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Student(BaseModel):
    id: int
    name: str
    score: int

students: list[Student] = [
    Student(id=1, name="John Doe", score=20),
    Student(id=2, name="Jim Hanh", score=40),
    Student(id=3, name="Jack Gobert", score=55),
]

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/students", response_model=list[Student])
async def show_students():
    return students

@app.get("/students/sum")
async def show_sum():
    return {"scores": sum(student.score for student in students)}

@app.get("/students/{sid}", response_model=Student)
async def show_student(sid: int):
    student = next((student for student in students if student.id == sid), None)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    return student

@app.post("/students", response_model=Student, status_code=status.HTTP_201_CREATED)
async def add_student(student: Student):
    if any(existing.id == student.id for existing in students):
        raise HTTPException(status_code=409, detail="Student ID already exists")

    students.append(student)
    return student

@app.put("/students/{sid}", response_model=Student)
async def update_student(sid: int, student: Student):
    if student.id != sid:
        raise HTTPException(status_code=400, detail="Student ID cannot be changed")

    student_index = next(
        (index for index, existing in enumerate(students) if existing.id == sid),
        None,
    )
    if student_index is None:
        raise HTTPException(status_code=404, detail="Student not found")

    students[student_index] = student
    return student


@app.delete("/students/{sid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(sid: int):
    student_index = next(
        (index for index, student in enumerate(students) if student.id == sid),
        None,
    )
    if student_index is None:
        raise HTTPException(status_code=404, detail="Student not found")

    students.pop(student_index)
