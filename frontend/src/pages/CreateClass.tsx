import { useState } from 'react'
import Button from '../components/Button'
import Textbox from '../components/Textbox'
import StatusMessage from '../components/StatusMessage'
import './CreateClass.css'
import { createClass } from '../util/api'

export default function CreateClass() {
  const [name, setName] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success'>('error')
  const [isSubmitting, setIsSubmitting] = useState(false);

  const attemptCreateClass = async () => {
  if (isSubmitting) return;
  
  try {
    setIsSubmitting(true);
    setStatusMessage("");
    await createClass(name);
    setStatusType("success");
    setStatusMessage("Class created successfully!");
    setName("");
  } catch (error) {
    console.error("Error creating class:", error);
    setStatusType("error");
    setStatusMessage(
      error instanceof Error ? error.message : "Error creating class."
    );
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="CreateClass">
      <h1>Create Class</h1>

      <StatusMessage message={statusMessage} type={statusType} />

      <h2>Class Name</h2>
      <Textbox onInput={setName} />
      
      <Button onClick={attemptCreateClass} disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit"}
      </Button>
    </div>
  )
}

