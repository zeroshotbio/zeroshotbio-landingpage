// src/app/api/visitors/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

// Debug: Log the environment variables (avoid logging secrets in production)
console.log("AWS_REGION:", process.env.AWS_REGION);
console.log(
  "DYNAMODB_TABLE_NAME:",
  process.env.AWS_DYNAMODB_TABLE_NAME || "zeroshot_dataroom_visitor_tracking"
);

// Initialize the DynamoDB client with credentials and region from environment variables
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION, // e.g., "us-east-2"
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const TABLE_NAME =
  process.env.AWS_DYNAMODB_TABLE_NAME || "zeroshot_dataroom_visitor_tracking";

// POST handler: Logs visitor details and start time into DynamoDB
export async function POST(request: NextRequest) {
  try {
    console.log("Incoming request:", request);
    const body = await request.json();
    console.log("Parsed body:", body);

    const { firstName, lastName, password } = body;
    if (!firstName || !lastName || !password) {
      throw new Error("Missing required fields");
    }

    const id = crypto.randomUUID();
    const visitStart = Date.now();

    // Construct the item to store
    const item = {
      id,
      firstName,
      lastName,
      passwordUsed: password,
      visitStart,
    };

    // Prepare the PutItem command
    const command = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item),
    });

    await ddbClient.send(command);
    console.log("Successfully inserted item into DynamoDB with id:", id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error in POST /api/visitors:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// PUT handler: Logs visitor exit time by updating the existing record in DynamoDB
export async function PUT(request: NextRequest) {
  try {
    // Read the raw text from the request
    const text = await request.text();
    if (!text) {
      console.warn("PUT /api/visitors: Empty request body received.");
      // Instead of throwing an error, respond with a benign message
      return NextResponse.json(
        { success: true, message: "Empty request body" },
        { status: 200 }
      );
    }
    const body = JSON.parse(text);
    console.log("Received PUT body:", body);
    const { id } = body;
    if (!id) {
      throw new Error("No visitor ID provided");
    }

    const visitEnd = Date.now();

    // Prepare the UpdateItem command to add the exit time attribute
    const command = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id }), // 'id' is assumed to be the partition key
      UpdateExpression: "set visitEnd = :end",
      ExpressionAttributeValues: marshall({ ":end": visitEnd }),
      ReturnValues: "UPDATED_NEW",
    });

    await ddbClient.send(command);
    console.log("Successfully updated item with exit time for id:", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PUT /api/visitors:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// GET handler: Optional, not implemented in this example.
export async function GET(request: NextRequest) {
  return NextResponse.json({ success: true, message: "GET not implemented" });
}
