import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Textbox from '../components/Textbox';
import StatusMessage from '../components/StatusMessage';
import { createTeacherAccount } from '../util/api';
import './CreateTeacher.css';

export default function CreateTeacher() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdTeacher, setCreatedTeacher] = useState<User | null>(null);

  const handleCreateTeacher = async () => {
    try {
      setError('');
      setSuccess(false);

      if (!name || !email || !password) {
        setError('All fields are required');
        return;
      }

      if (password.length < 6) {
        setError('Temporary password must be at least 6 characters');
        return;
      }

      const result = await createTeacherAccount(name, email, password);
      setCreatedTeacher(result.user);
      setSuccess(true);
      
      // Clear form
      setName('');
      setEmail('');
      setPassword('');
    } catch {
      setError('Failed to create teacher account');
    }
  };

  return (
    <div className="CreateTeacherPage">
      <div className="CreateTeacherCard">
        <div className="CreateTeacherHeader">
          <div>
            <p className="CreateTeacherEyebrow">Admin Tools</p>
            <h1>Create Teacher Account</h1>
          </div>
          <p className="CreateTeacherIntro">
            Add a teacher account and give them a temporary password for their
            first sign-in.
          </p>
        </div>

        <div className="CreateTeacherStatusStack">
          <StatusMessage message={error} type="error" />

        {success && createdTeacher && (
          <StatusMessage message="" type="success">
            <div className="CreateTeacherSuccess">
              <strong>Teacher account created successfully.</strong>
              <div className="CreateTeacherSuccessDetails">
                <div><strong>Name:</strong> {createdTeacher.name}</div>
                <div><strong>Email:</strong> {createdTeacher.email}</div>
                <div><strong>Temporary Password:</strong> Provided by you</div>
              </div>
              <p className="CreateTeacherSuccessNote">
                The teacher will be prompted to change their password on first login.
              </p>
            </div>
          </StatusMessage>
        )}
        </div>

        <div className="CreateTeacherFormGrid">
          <label className="CreateTeacherField">
            <span>Teacher Name</span>
            <Textbox
              placeholder='Full name'
              value={name}
              onInput={setName}
              className='CreateTeacherInput'
            />
          </label>

          <label className="CreateTeacherField">
            <span>Institutional Email</span>
            <Textbox
              type='email'
              placeholder='teacher@institution.edu'
              value={email}
              onInput={setEmail}
              className='CreateTeacherInput'
            />
          </label>

          <label className="CreateTeacherField CreateTeacherFieldFull">
            <span>Temporary Password</span>
            <Textbox
              type='password'
              placeholder='At least 6 characters'
              value={password}
              onInput={setPassword}
              className='CreateTeacherInput'
            />
            <small>
              Share this password with the teacher securely. They&apos;ll be
              asked to replace it after they log in.
            </small>
          </label>
        </div>

        <div className="CreateTeacherActions">
          <Button onClick={handleCreateTeacher}>
            Create Teacher
          </Button>
          <Button onClick={() => navigate('/home')} type='secondary'>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
