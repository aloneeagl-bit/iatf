/**
 * Cloud Drive Synchronization Service
 * Supports Google Drive and Microsoft OneDrive Integration for QMS Database
 */

export interface CloudProviderConfig {
  accessToken: string;
  fileId: string;
  fileName: string;
  clientId: string;
}

export class CloudDriveSyncService {
  // Safe general default client IDs (users can and should override them via the UI)
  public static readonly DEFAULT_GDRIVE_CLIENT_ID = "939178307093-gdrive-demo-client-id-placeholder.apps.googleusercontent.com";
  public static readonly DEFAULT_ONEDRIVE_CLIENT_ID = "onedrive-demo-client-id-placeholder";

  /**
   * Generates the OAuth Google Drive authorization path
   */
  public static getGoogleAuthUrl(clientId: string): string {
    const activeClientId = clientId.trim() || this.DEFAULT_GDRIVE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scopes = encodeURIComponent("https://www.googleapis.com/auth/drive.file");
    
    return `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(activeClientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${scopes}` +
      `&prompt=consent`;
  }

  /**
   * Generates the OAuth Microsoft OneDrive authorization path
   */
  public static getOneDriveAuthUrl(clientId: string): string {
    const activeClientId = clientId.trim() || this.DEFAULT_ONEDRIVE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scopes = encodeURIComponent("files.readwrite offline_access");
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(activeClientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${scopes}`;
  }

  // ==========================================
  // GOOGLE DRIVE OPERATIONS
  // ==========================================

  /**
   * Search for the specific database file in Google Drive
   */
  public static async findGDriveFile(token: string, fileName: string = "qms_database_store.json"): Promise<string | null> {
    if (!token) throw new Error("Google access token is missing.");
    
    const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive search failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  /**
   * Download QMS database contents from Google Drive
   */
  public static async downloadGDriveFile(token: string, fileId: string): Promise<any> {
    if (!token) throw new Error("Google access token is missing.");
    if (!fileId) throw new Error("File ID is missing.");

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed downloading file from Google Drive: ${response.status} - ${errText}`);
    }

    return await response.json();
  }

  /**
   * Create a new database file in Google Drive (Multipart metadata + media)
   */
  public static async createGDriveFile(token: string, fileName: string, fileContent: string): Promise<string> {
    if (!token) throw new Error("Google access token is missing.");

    const metadata = {
      name: fileName,
      mimeType: "application/json"
    };

    const boundary = "QMS_CLOUD_SYNC_BOUNDARY_MARKER";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      fileContent +
      closeDelimiter;

    const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed creating file on Google Drive: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Update the binary/JSON media content of an existing file on Google Drive
   */
  public static async updateGDriveFile(token: string, fileId: string, fileContent: string): Promise<boolean> {
    if (!token) throw new Error("Google access token is missing.");
    if (!fileId) throw new Error("File ID is missing.");

    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: fileContent
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed updating Google Drive file: ${response.status} - ${errText}`);
    }

    return true;
  }

  // ==========================================
  // MICROSOFT ONEDRIVE OPERATIONS
  // ==========================================

  /**
   * Download file content from Microsoft OneDrive
   */
  public static async downloadOneDriveFile(token: string, fileName: string = "qms_database_store.json"): Promise<any> {
    if (!token) throw new Error("OneDrive access token is missing.");

    // Microsoft Graph endpoint allows targeting files directly via path: /me/drive/root:/folder/file:/content
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // File does not exist yet
        return null;
      }
      const errText = await response.text();
      throw new Error(`Failed downloading file from OneDrive: ${response.status} - ${errText}`);
    }

    return await response.json();
  }

  /**
   * Upload or replace file contents on Microsoft OneDrive
   */
  public static async uploadOneDriveFile(token: string, fileName: string, fileContent: string): Promise<boolean> {
    if (!token) throw new Error("OneDrive access token is missing.");

    // Simple PUT to Microsoft Graph OneDrive /content endpoint creates or completely replaces the file
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`;
    
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: fileContent
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed uploading file to OneDrive: ${response.status} - ${errText}`);
    }

    return true;
  }
}
