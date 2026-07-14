import React, { useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import Swal from "sweetalert2";

const EditFitIntro = () => {
  const editorRef = useRef(null);
  const [editorContent, setEditorContent] = useState("");
  const [error, setError] = useState("");
  const api_key = "3e4i7xmjvw1ebtnzlwcfxtlk0tuwjfui4s1w0l2pibtj6egn";

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate editor content
    if (!editorContent) {
      setError("Introduction content cannot be empty.");
      return;
    }

    // Show SweetAlert2 confirmation dialog
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, submit it!'
    }).then((result) => {
      if (result.isConfirmed) {
        // Log the content to console
        console.log("Saved Introduction Content:", editorContent);

        // Optionally, you could send this data to an API here

        // Clear the content and error message after submission
        setEditorContent("");
        setError("");

        Swal.fire(
          'Submitted!',
          'Your introduction has been submitted.',
          'success'
        );
      }
    });
  };

  // Function to go back to the previous page
  const handleBack = () => {
    window.history.back();
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <div>
          <h1>
            <span className="mr-4 fw-bold">&nbsp;Introduction</span>
          </h1>
        </div>
      </div>
      <button
        className="btn mb-2 ms-2"
        style={{
          backgroundColor: "#00489d",
          color: "white",
        }}
        type="button"
        onClick={handleBack}
      >
        <i className="fa-solid fa-arrow-left" style={{ color: "#fff" }}></i>{" "}
        &nbsp;Previous
      </button>
      <div className="row">
        <div className="col-md-12 px-5">
          <div className="tile">
            <div
              className="case-status d-flex justify-content-center text-align-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
                textAlign: "center",
                width: "100%",
              }}
            >
              <h4 style={{ marginTop: "12px" }}>Add Introduction</h4>
            </div>
            <div className="tile-body p-3">
              <div className="bs-component">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-lg-12 mt-2">
                      <label className="form-label" htmlFor="editorContent">
                        Introduction Content
                      </label>
                      <div>
                        <Editor
                          apiKey={api_key}
                          value={editorContent}
                          onEditorChange={(content) => setEditorContent(content)}
                          onInit={(_evt, editor) => (editorRef.current = editor)}
                        />
                      </div>
                      {error && (
                        <div className="invalid-feedback d-block">
                          {error}
                        </div>
                      )}
                    </div>
                    <div className="col-lg-12 col-sm-12 col-xs-12 col-md-12 mt-2 text-center">
                      <button
                        className="btn custom-btn text-white mt-2 w-20pr"
                        type="submit"
                      >
                        Add Introduction
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width={25}
                          height={25}
                          viewBox="0 0 16 16"
                        >
                          <path
                            fill="#fff"
                            d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default EditFitIntro