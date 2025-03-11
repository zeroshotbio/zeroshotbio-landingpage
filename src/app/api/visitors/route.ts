// src/app/api/visitors/route.ts
import { NextRequest, NextResponse } from 'next/server';

// In-memory store for demonstration only.
// Replace this with a real database if you need persistence.
let visitorLogs: {
  id: string;
  firstName: string;
  lastName: string;
  visitStart: number;     // When they entered
  visitEnd?: number;      // When they left
  passwordUsed: string;
}[] = [];

export async function POST(request: NextRequest) {
  try {
    // This POST will be used to log a fresh visit (start time, plus data)
    // The client should send firstName, lastName, password
    const body = await request.json();
    const { firstName, lastName, password } = body;

    // Create a unique identifier for this session
    // A real setup might use a DB auto-increment or user session ID
    const id = crypto.randomUUID();
    const visitStart = Date.now();

    visitorLogs.push({
      id,
      firstName,
      lastName,
      visitStart,
      passwordUsed: password,
    });

    // Return the unique ID so the client can reference this visit later
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // This PUT is used to mark the end time for a visitor
    // The client should send the ID that was received from the POST
    const body = await request.json();
    const { id } = body;

    // Find the log entry
    const index = visitorLogs.findIndex((v) => v.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Visitor not found' }, { status: 404 });
    }

    // Mark end time
    visitorLogs[index].visitEnd = Date.now();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function GET() {
  // For demonstration: returning all logs. 
  // In a real app, you'd likely secure this or remove it entirely.
  return NextResponse.json(visitorLogs);
}
