import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Textbox from '../components/Textbox';
import StatusMessage from '../components/StatusMessage';
import { changePassword } from '../util/api';
import './ChangePassword.css';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async () => {
    try {
      setError('');
      setSuccess(false);

      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('All fields are required');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }

      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }

      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      
      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/home');
        onClose();
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to change password');
      } else {
        setError('Failed to change password');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ChangePasswordOverlay">
      <div className="ChangePasswordModal" onClick={(e) => e.stopPropagation()}>
        <div className="PasswordBlock">
          <h1>Change Password</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            You must change your temporary password before continuing.
          </p>

          <StatusMessage message={error} type="error" />
          {success && (
            <StatusMessage 
              message="Password changed successfully! Redirecting..." 
              type="success" 
            />
          )}

          <div className="PasswordInputs">
            <div className="PasswordInputChunk">
              <span>Current Password</span>
              <Textbox
                type='password'
                placeholder='Current password...'
                onInput={setCurrentPassword}
                className='PasswordInput'
              />
            </div>

            <div className="PasswordInputChunk">
              <span>New Password</span>
              <Textbox
                type='password'
                placeholder='New password...'
                onInput={setNewPassword}
                className='PasswordInput'
              />
            </div>

            <div className="PasswordInputChunk">
              <span>Confirm New Password</span>
              <Textbox
                type='password'
                placeholder='Confirm new password...'
                onInput={setConfirmPassword}
                className='PasswordInput'
              />
            </div>
          </div>

          <div className="PasswordButtonContainer">
            <Button
              onClick={handleChangePassword}
              disabled={success}
            >
              Change Password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Page wrapper for route - always shows modal with isOpen=true
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  
  const handleClose = () => {
    navigate('/home'); 
  };

  return <ChangePasswordModal isOpen={true} onClose={handleClose} />;
}
