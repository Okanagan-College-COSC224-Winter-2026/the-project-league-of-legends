import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import "./AdminUserManagement.css";
import Textbox from '../components/Textbox';
import StatusMessage from '../components/StatusMessage';
import {
  listAllUsers,
  createUser,
  updateUserDetails,
  updateUserRole,
  deleteUser,
  resetUserPassword,
} from '../util/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  
}

type FormMode = 'view' | 'create' | 'edit';

interface PasswordResetState {
  isOpen: boolean;
  userId: number | null;
  userName: string;
  newPassword: string;
  
}

export default function AdminUserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('view');
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordReset, setPasswordReset] = useState<PasswordResetState>({
    isOpen: false,
    userId: null,
    userName: '',
    newPassword: '',
  });

  // Get current logged-in user ID
  const currentUserId = (() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.user_id;
    }
    return null;
  })();

  // Form fields
  const [formData, setFormData] = useState({
    id: 0,
    name: '',
    email: '',
    password: '',
    role: 'student',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await listAllUsers();
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClick = () => {
    setFormData({ id: 0, name: '', email: '', password: '', role: 'student' });
    setFormMode('create');
    setError('');
    setSuccess('');
  };

  const handleEditClick = (user: User) => {
    setFormData({ ...user, password: '' });
    setFormMode('edit');
    setError('');
    setSuccess('');
  };

  const handleCancelForm = () => {
    setFormMode('view');
    setFormData({ id: 0, name: '', email: '', password: '', role: 'student' });
  };

  const validateForm = (): boolean => {

    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(formData.name)) {
      setError('Name can only contain letters and spaces');
      return false;
    }

    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
    setError('Please enter a valid email address');
    return false;
    }
    if (formMode === 'create' && !formData.password) {
      setError('Password is required for new users');
      return false;
    }
    if (formMode === 'create' && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleSubmitForm = async () => {
    if (!validateForm()) return;

    try {
      setError('');
      setSuccess('');

      if (formMode === 'create') {
        await createUser(
          formData.name,
          formData.email,
          formData.password,
          formData.role,
          false
        );
        setSuccess(`User ${formData.name} created successfully!`);
        setFormMode('view');
      } else if (formMode === 'edit') {
        // Update user details (name and email)
        if (formData.name || formData.email) {
          await updateUserDetails(formData.id, {
            name: formData.name,
            email: formData.email,
          });
        }

        // Update role if it changed
        const originalUser = users.find(u => u.id === formData.id);
        if (originalUser && originalUser.role !== formData.role) {
          await updateUserRole(formData.id, formData.role);
        }

        setSuccess('User updated successfully!');
        setFormMode('view');
      }

      // Refresh user list
      await fetchUsers();
      setFormData({ id: 0, name: '', email: '', password: '', role: 'student' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (userId === currentUserId) {
      setError('You cannot delete your own account');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${userName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError('');
      setSuccess('');
      await deleteUser(userId);
      setSuccess(`User ${userName} deleted successfully!`);
      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      setError(message);
    }
  };

  const handleResetPasswordClick = (userId: number, userName: string) => {
    if (userId === currentUserId) {
      setError('You cannot reset your own password this way');
      return;
    }
    setPasswordReset({
      isOpen: true,
      userId,
      userName,
      newPassword: '',
    });
    setError('');
  };

  const handleResetPasswordCancel = () => {
    setPasswordReset({
      isOpen: false,
      userId: null,
      userName: '',
      newPassword: '',
    });
  };

  const handleResetPasswordSubmit = async () => {
    if (!passwordReset.newPassword || passwordReset.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!passwordReset.userId) return;

    try {
      setError('');
      setSuccess('');
      await resetUserPassword(passwordReset.userId, passwordReset.newPassword);
      setSuccess(
        `Password reset for ${passwordReset.userName}. They will be required to change it on next login.`
      );
      handleResetPasswordCancel();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
    }
  };

  return (
    <>
      <div className="AdminUserManagement-Header">
        <div className="AdminUserManagement-HeaderLeft">
          <h1>User Management</h1>
        </div>
        <div className="AdminUserManagement-HeaderRight">
          <Button onClick={handleCreateClick}>Create User</Button>
        </div>
      </div>

      <StatusMessage message={error} type="error" />
      <StatusMessage message={success} type="success" />

      {formMode !== 'view' && (
        <div className="AdminUserManagement-Modal">
          <div className="AdminUserManagement-ModalContent">
            <h2>
              {formMode === 'create' ? 'Create New User' : 'Edit User'}
            </h2>

            <div className="AdminUserManagement-FormBody">
              <div className="AdminUserManagement-FormGroup">
                <span>Name</span>
                <Textbox
                  placeholder="Full name..."
                  value={formData.name}
                  onInput={(val) =>
                    setFormData({ ...formData, name: val })
                  }
                  className="AdminUserManagement-Input"
                />
              </div>

              <div className="AdminUserManagement-FormGroup">
                <span>Email</span>
                <Textbox
                  type="email"
                  placeholder="user@example.com..."
                  value={formData.email}
                  onInput={(val) =>
                    setFormData({ ...formData, email: val })
                  }
                  className="AdminUserManagement-Input"
                />
              </div>

              {formMode === 'create' && (
                <div className="AdminUserManagement-FormGroup">
                  <span>Password</span>
                  <Textbox
                    type="password"
                    placeholder="Password (min 6 characters)..."
                    value={formData.password}
                    onInput={(val) =>
                      setFormData({ ...formData, password: val })
                    }
                    className="AdminUserManagement-Input"
                  />
                </div>
              )}

              <div className="AdminUserManagement-FormGroup">
                <span>Role</span>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="AdminUserManagement-Select"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="AdminUserManagement-ModalFooter">
              <Button onClick={handleSubmitForm}>
                {formMode === 'create' ? 'Create User' : 'Save Changes'}
              </Button>
              <Button onClick={handleCancelForm} type="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {formMode === 'view' && (
        <div className="AdminUserManagement-Body">
          <div className="AdminUserManagement-SearchBar">
            <Textbox
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onInput={setSearchQuery}
              className="AdminUserManagement-SearchInput"
            />
          </div>

          {loading ? (
            <div className="AdminUserManagement-LoadingMessage">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="AdminUserManagement-EmptyMessage">
              {users.length === 0
                ? 'No users found.'
                : 'No users match your search.'}
            </div>
          ) : (
            <div className="AdminUserManagement-TableWrapper">
              <table className="AdminUserManagement-Table">
                <thead className="AdminUserManagement-TableHead">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="AdminUserManagement-TableBody">
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className={`AdminUserManagement-RoleBadge ${user.role}`}
                        >
                          {user.role.charAt(0).toUpperCase() +
                            user.role.slice(1)}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleEditClick(user)}
                          className="AdminUserManagement-EditButton"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            handleResetPasswordClick(user.id, user.name)
                          }
                          disabled={user.id === currentUserId}
                          className="AdminUserManagement-ResetButton"
                          title={user.id === currentUserId ? 'You cannot reset your own password this way' : ''}
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteUser(user.id, user.name)
                            }
                            disabled={user.id === currentUserId}
                            className="AdminUserManagement-DeleteButton"
                            title={user.id === currentUserId ? 'You cannot delete your own account' : ''}
                          >
                            {user.id === currentUserId ? 'Delete (Self)' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="AdminUserManagement-Footer">
              Showing {filteredUsers.length} of {users.length} users
            </div>

            <div className="AdminUserManagement-BackButtonContainer">
              <Button onClick={() => navigate('/home')} type="secondary">
                Back to Home
              </Button>
            </div>
        </div>
      )}

      {passwordReset.isOpen && (
        <div className="AdminUserManagement-Modal">
          <div className="AdminUserManagement-ModalContent">
            <h2>Reset Password for {passwordReset.userName}</h2>
            <p>Enter a temporary password. The user will be required to change it on next login.</p>

            <div className="AdminUserManagement-FormGroup" style={{ marginTop: '15px' }}>
              <span>Temporary Password</span>
              <Textbox
                type="password"
                placeholder="Enter temporary password (min 6 characters)..."
                value={passwordReset.newPassword}
                onInput={(val) =>
                  setPasswordReset({ ...passwordReset, newPassword: val })
                }
                className="AdminUserManagement-Input"
              />
            </div>

            <div className="AdminUserManagement-ModalFooter">
              <Button onClick={handleResetPasswordSubmit}>
                Reset Password
              </Button>
              <Button onClick={handleResetPasswordCancel} type="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
