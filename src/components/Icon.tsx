import React from 'react';
import {
  ArrowRight, BookOpen, Bell, Bug, ChevronRight, Eye, EyeOff, FileCheck, FileText,
  Lock, LogOut, Mail, MapPin, Menu, ScanLine, ServerCog, Users, Wallet, Inbox, Check,
} from 'lucide-react-native';
import { colors } from '../theme';

const icons = {
  arrowRight: ArrowRight, book: BookOpen, bell: Bell, bug: Bug, chevron: ChevronRight,
  eye: Eye, eyeOff: EyeOff, fileCheck: FileCheck, file: FileText, lock: Lock,
  logout: LogOut, mail: Mail, pin: MapPin, menu: Menu, scan: ScanLine, server: ServerCog,
  users: Users, wallet: Wallet, inbox: Inbox, check: Check,
};

export type IconName = keyof typeof icons;

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export default function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.8 }: Props) {
  const Glyph = icons[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
