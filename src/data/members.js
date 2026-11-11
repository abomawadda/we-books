// بيانات الأعضاء — قراءة فقط. حاليًا من ملف تجريبي، ولاحقًا من دالة خادم تقرأ MyNekaba.
// الحقول: name, employeeNo, entity, mobile, membershipStatus ('active' | 'suspended')
import members from '../mock/members.mock.json';

export const membersSource = {
  async listMembers() { return members; },
  async getMember(employeeNo) { return members.find((m) => m.employeeNo === employeeNo) ?? null; },
};
