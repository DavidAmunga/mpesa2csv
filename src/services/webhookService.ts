import { MPesaStatement, ExportOptions } from "../types";
import { JsonService } from "./jsonService";

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  statusText?: string;
  responseBody?: string;
  error?: string;
}

export class WebhookService {
  /**
   * Sends M-Pesa statement data to a webhook endpoint as JSON
   * @param statement The M-Pesa statement to send
   * @param endpoint The URL of the webhook endpoint
   * @param options Export options for filtering/formatting
   * @returns WebhookResult with success status and details
   */
  static async sendToWebhook(
    statement: MPesaStatement,
    endpoint: string,
    options?: ExportOptions
  ): Promise<WebhookResult> {
    try {
      // Validate URL format
      let url: URL;
      try {
        url = new URL(endpoint);
      } catch (e) {
        return {
          success: false,
          error: "Invalid URL format. Please enter a valid HTTP or HTTPS URL.",
        };
      }

      // Only allow HTTP and HTTPS protocols
      if (!["http:", "https:"].includes(url.protocol)) {
        return {
          success: false,
          error: "Only HTTP and HTTPS protocols are supported.",
        };
      }

      // Convert statement to JSON format
      const jsonContent = JsonService.convertStatementToJson(statement, options);

      // Make POST request
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonContent,
      });

      // Read response body
      let responseBody = "";
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const jsonResponse = await response.json();
          responseBody = JSON.stringify(jsonResponse, null, 2);
        } else {
          responseBody = await response.text();
        }
      } catch (e) {
        responseBody = "Unable to read response body";
      }

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          statusText: response.statusText,
          responseBody: responseBody,
        };
      } else {
        return {
          success: false,
          statusCode: response.status,
          statusText: response.statusText,
          responseBody: responseBody,
          error: `Server returned ${response.status} ${response.statusText}`,
        };
      }
    } catch (error: any) {
      let errorMessage = "Failed to connect to endpoint";
      
      if (error.message) {
        if (error.message.includes("Failed to fetch")) {
          errorMessage = "Network error: Unable to connect to the endpoint. Please check your internet connection and the URL.";
        } else if (error.message.includes("CORS")) {
          errorMessage = "CORS error: The endpoint does not allow requests from this application.";
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validates if a URL string is properly formatted
   * @param urlString The URL to validate
   * @returns true if valid, false otherwise
   */
  static isValidUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      return ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  }
}

