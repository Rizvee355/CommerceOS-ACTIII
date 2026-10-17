import {
  createCapabilitiesResponse,
  createErrorResponse,
} from "../../../../server/api/responses";

export const runtime = "nodejs";

export const GET = async (): Promise<Response> => {
  try {
    return Response.json(createCapabilitiesResponse());
  } catch (error) {
    return Response.json(createErrorResponse(error), { status: 500 });
  }
};
