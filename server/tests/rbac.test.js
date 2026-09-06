import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAdmin, requireRole, requireStaffCategory, requireVerified } from '../middleware/authMiddleware.js';

const invoke = (middleware, user) => {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  middleware({ user }, response, () => { nextCalled = true; });
  return { nextCalled, response };
};

test('role middleware permits only an explicitly allowed role', () => {
  assert.equal(invoke(requireRole('doctor'), { role: 'doctor' }).nextCalled, true);
  const denied = invoke(requireRole('doctor'), { role: 'admin' });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.response.statusCode, 403);
});

test('admin middleware cannot be satisfied by another verified role', () => {
  assert.equal(invoke(requireAdmin, { role: 'admin', is_verified: true }).nextCalled, true);
  assert.equal(invoke(requireAdmin, { role: 'doctor', is_verified: true }).response.statusCode, 403);
});

test('staff category middleware isolates receptionist operations', () => {
  assert.equal(
    invoke(requireStaffCategory('receptionist'), { role: 'staff', staff_category: 'receptionist' }).nextCalled,
    true
  );
  assert.equal(
    invoke(requireStaffCategory('receptionist'), { role: 'staff', staff_category: 'nurse' }).response.statusCode,
    403
  );
});

test('patients pass verification while unverified privileged accounts do not', () => {
  assert.equal(invoke(requireVerified, { role: 'patient', is_verified: false }).nextCalled, true);
  assert.equal(invoke(requireVerified, { role: 'doctor', is_verified: false }).response.statusCode, 403);
});
