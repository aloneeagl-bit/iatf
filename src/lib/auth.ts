import { User } from '../components/TeamManagementTypes';

/**
 * Simple hash function for demonstration.
 * In a real production app, use bcrypt or PBKDF2 on the server.
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const USERS_STORAGE_KEY = 'iatf_qms_users';
const SESSION_STORAGE_KEY = 'iatf_qms_session';

export class AuthManager {
  private static async getUsers(): Promise<User[]> {
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    let users: User[];
    if (!saved) {
      // Seed default admin
      const admin: User = {
        id: 'usr-dev-admin',
        username: 'admin',
        password: '123', // Keeping legacy password field for TeamManagement compatibility
        fullName: 'مدیر ارشد سیستم',
        role: 'admin',
        isOnline: true,
        lastLoginAt: new Date().toISOString(),
        email: 'aloneeagl@gmail.com', // Base email for recovery
        securityQuestion: 'نام سیستم چیست؟',
        securityAnswer: await hashString('iatf'),
        permissions: {
          home: true,
          iatf: true,
          iatf_tools: true,
          csr: true,
          indicators: true,
          strategic_management: true,
          iso9001_docs: true,
          db_explorer: true,
          records: true
        }
      };
      users = [admin];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } else {
      users = JSON.parse(saved);
      // Ensure existing users have email addresses for the recovery upgrade
      let modified = false;
      users = users.map(u => {
        if (!u.email) {
          modified = true;
          return { 
            ...u, 
            email: u.username === 'admin' ? 'aloneeagl@gmail.com' : `${u.username}@iatf-qms.ir` 
          };
        }
        return u;
      });
      if (modified) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
    }
    return users;
  }

  static async login(username: string, password: string): Promise<User | null> {
    const users = await this.getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      const sessionUser = { ...user, isOnline: true, lastLoginAt: new Date().toISOString() };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
      return sessionUser;
    }
    return null;
  }

  static logout() {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  static getCurrentUser(): User | null {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  }

  /**
   * Generates a 6-digit OTP code, stores it in localStorage with a 5-minute expiry,
   * and returns it so the UI can simulate sending it to the user.
   */
  static async sendResetCode(emailOrUsername: string): Promise<{ success: boolean; code?: string; error?: string }> {
    const users = await this.getUsers();
    const identifier = emailOrUsername.toLowerCase().trim();
    
    // Support finding by email or username
    const user = users.find(u => 
      (u.email && u.email.toLowerCase().trim() === identifier) ||
      u.username.toLowerCase().trim() === identifier
    );

    if (!user) {
      return { 
        success: false, 
        error: 'هیچ حساب کاربری معتبری با این ایمیل یا نام کاربری یافت نشد.' 
      };
    }

    if (!user.email) {
      return {
        success: false,
        error: 'برای این کاربر هیچ ایمیلی ثبت نشده است.'
      };
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    // Store in localStorage for verification
    localStorage.setItem('iatf_qms_otp_reset', JSON.stringify({
      email: user.email,
      username: user.username,
      code: otpCode,
      expiry
    }));

    return {
      success: true,
      code: otpCode
    };
  }

  /**
   * Verifies the OTP reset code and updates the user's password if valid.
   */
  static async verifyResetCodeAndChangePassword(emailOrUsername: string, code: string, newPassword: string): Promise<boolean> {
    const users = await this.getUsers();
    const resetDataRaw = localStorage.getItem('iatf_qms_otp_reset');
    if (!resetDataRaw) return false;

    try {
      const resetData = JSON.parse(resetDataRaw);
      if (Date.now() > resetData.expiry) {
        return false; // Code expired
      }

      // Check code
      if (resetData.code !== code.trim()) {
        return false;
      }

      const identifier = emailOrUsername.toLowerCase().trim();
      const isMatch = 
        resetData.email.toLowerCase().trim() === identifier ||
        resetData.username.toLowerCase().trim() === identifier;

      if (!isMatch) return false;

      // Update password
      const userIndex = users.findIndex(u => u.username === resetData.username);
      if (userIndex === -1) return false;

      users[userIndex].password = newPassword;
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

      // Sync with qms_users
      const qmsUsersRaw = localStorage.getItem('qms_users');
      if (qmsUsersRaw) {
        try {
          const qmsUsers = JSON.parse(qmsUsersRaw);
          const qmsIndex = qmsUsers.findIndex((u: any) => u.username === resetData.username);
          if (qmsIndex !== -1) {
            qmsUsers[qmsIndex].password = newPassword;
            localStorage.setItem('qms_users', JSON.stringify(qmsUsers));
          }
        } catch {}
      }

      // Clear reset token
      localStorage.removeItem('iatf_qms_otp_reset');
      return true;
    } catch {
      return false;
    }
  }

  // Keeping legacy security question methods for backwards compatibility
  static async getRecoveryQuestion(username: string): Promise<string | null> {
    const users = await this.getUsers();
    const user = users.find(u => u.username === username);
    return user ? user.securityQuestion : null;
  }

  static async resetPassword(username: string, answer: string, newPassword: string): Promise<boolean> {
    const users = await this.getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) return false;
    const user = users[userIndex];
    const answerHash = await hashString(answer.toLowerCase().trim());
    if (user.securityAnswer === answerHash) {
      users[userIndex].password = newPassword;
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      return true;
    }
    return false;
  }
}
