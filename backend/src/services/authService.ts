import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { RegisterRequest, LoginRequest, AuthResponse, JWTPayload } from '../types/auth';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

class AuthService {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    });

    // Generate token
    const token = this.generateToken(user.id, user.email);

    return {
      token,
      user,
    };
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  private generateToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });
  }
}

export default new AuthService();
