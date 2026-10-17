import {
  createErrorResponse,
  createHealthResponse,
} from "../../../../server/api/responses";

export const runtime = "nodejs";

export const GET = async (): Promise<Response> => {
  try {
    return Response.json(createHealthResponse());
  } catch (error) {
    return Response.json(createErrorResponse(error), { status: 500 });
  }
};
