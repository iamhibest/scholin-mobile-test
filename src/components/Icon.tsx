import React from 'react';
import {
  ArrowRight, BookOpen, Bell, Bug, ChevronRight, Eye, EyeOff, FileCheck, FileText,
  Lock, LogOut, Mail, MapPin, Menu, ScanLine, ServerCog, Users, Wallet, Inbox, Check,
  User, Phone, KeyRound, Info, School, UserPlus, Search,
  Clock, Megaphone, Briefcase, GraduationCap, CalendarDays, CreditCard, Settings, ArrowUp, ArrowDown,
  ChevronDown, X, Plus, ClipboardCheck, Gift, Shield, LayoutGrid, Layers, QrCode, Building2, UserCog,
  LayoutDashboard, Receipt, Tags, TrendingUp, ListChecks, Landmark,
  MessageSquare, CalendarCheck, ShieldCheck, Pencil, Trash2, Send,
} from 'lucide-react-native';
import { colors } from '../theme';

const icons = {
  arrowRight: ArrowRight, book: BookOpen, bell: Bell, bug: Bug, chevron: ChevronRight,
  eye: Eye, eyeOff: EyeOff, fileCheck: FileCheck, file: FileText, lock: Lock,
  logout: LogOut, mail: Mail, pin: MapPin, menu: Menu, scan: ScanLine, server: ServerCog,
  users: Users, wallet: Wallet, inbox: Inbox, check: Check,
  user: User, phone: Phone, key: KeyRound, info: Info, school: School, userPlus: UserPlus, search: Search,
  clock: Clock, megaphone: Megaphone, briefcase: Briefcase, cap: GraduationCap, calendar: CalendarDays,
  card: CreditCard, settings: Settings, up: ArrowUp, down: ArrowDown, chevronDown: ChevronDown, close: X,
  plus: Plus, clipboard: ClipboardCheck, gift: Gift, shield: Shield, grid: LayoutGrid, layers: Layers,
  qr: QrCode, building: Building2, userCog: UserCog, dashboard: LayoutDashboard, receipt: Receipt,
  tags: Tags, trend: TrendingUp, checklist: ListChecks, bank: Landmark,
  chat: MessageSquare, calendarCheck: CalendarCheck, shieldCheck: ShieldCheck, edit: Pencil, trash: Trash2, send: Send,
};

export type IconName = keyof typeof icons;

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export default function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.8 }: Props) {
  const Glyph = icons[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
