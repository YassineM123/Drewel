import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import CreatableSelect from "react-select/creatable";

const DietMeal = () => {
  const location = useLocation();
  const dietData = location.state?.diet;

  const [formData, setFormData] = useState({
    week: dietData?.week || "",
    day: dietData?.day || "",
    meal: dietData?.meal || "",
    food: dietData?.food || "",
  });

  const [isAlert, setIsAlert] = useState(false);
  const [errors, setErrors] = useState({});
  const [suggestions, setSuggestions] = useState([
    { value: "Apple", label: "Apple" },
    { value: "Banana", label: "Banana" },
    { value: "Chicken Salad", label: "Chicken Salad" },
    { value: "Oatmeal", label: "Oatmeal" },
  ]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: errors.food ? "red" : base.borderColor,
      "&:hover": { borderColor: errors.food ? "red" : base.borderColor },
    }),
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setErrors((prevErrors) => ({ ...prevErrors, [name]: "" }));

    if (name === "food") {
      // Filter suggestions based on the entered value
      const filteredSuggestions = suggestions.filter((food) =>
        food.toLowerCase().includes(value.toLowerCase())
      );
      setShowAddButton(value && !suggestions.includes(value));
      setShowSuggestions(true);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.week) newErrors.week = "Week is required.";
    if (!formData.day) newErrors.day = "Day is required.";
    if (!formData.meal) newErrors.meal = "Meal type is required.";
    if (!formData.food) newErrors.food = "Food name is required.";
    return newErrors;
  };

  const handleFoodChange = (selectedOption) => {
    setFormData((prevData) => ({
      ...prevData,
      food: selectedOption,
    }));
  };

  const handleFoodCreate = (inputValue) => {
    const newOption = { value: inputValue, label: inputValue };
    setSuggestions((prevSuggestions) => [...prevSuggestions, newOption]);
    setFormData((prevData) => ({ ...prevData, food: newOption }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    console.log(formData);
    setIsAlert(true);
    setFormData({ week: "", day: "", meal: "", food: "" });
    setTimeout(() => setIsAlert(false), 3000);
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>
          <span className="mr-4 fw-bold">
            {dietData ? "Edit" : "Add"} Diet Meal Plan
          </span>
        </h1>
      </div>
      <button
        className="btn mb-2 ms-2"
        style={{ backgroundColor: "#00489d", color: "white" }}
        type="button"
        onClick={() => window.history.back()}
      >
        <i className="fa-solid fa-arrow-left" style={{ color: "#fff" }}></i>{" "}
        &nbsp;Previous
      </button>
      <div className="row justify-content-center">
        <div className="col-md-10 px-5">
          <div className="tile">
            <div
              className="case-status d-flex justify-content-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
                textAlign: "center",
                width: "100%",
              }}
            >
              <h4 className="mt-2">{dietData ? "Edit Food" : "Add Food"}</h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="mb-3 col-md-6">
                    <label className="form-label">Choose Week</label>
                    <select
                      className={`form-select ${
                        errors.week ? "is-invalid" : ""
                      }`}
                      name="week"
                      value={formData.week}
                      onChange={handleChange}
                    >
                      <option value="">Select Week</option>
                      <option value="week1">Week 1</option>
                      <option value="week2">Week 2</option>
                      <option value="week3">Week 3</option>
                      <option value="week4">Week 4</option>
                    </select>
                    {errors.week && (
                      <div className="invalid-feedback">{errors.week}</div>
                    )}
                  </div>

                  <div className="mb-3 col-md-6">
                    <label className="form-label">Choose Day</label>
                    <select
                      className={`form-select ${
                        errors.day ? "is-invalid" : ""
                      }`}
                      name="day"
                      value={formData.day}
                      onChange={handleChange}
                    >
                      <option value="">Select Day</option>
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                    {errors.day && (
                      <div className="invalid-feedback">{errors.day}</div>
                    )}
                  </div>

                  <div className="mb-3 col-md-6">
                    <label className="form-label">Choose Meal Type</label>
                    <select
                      className={`form-select ${
                        errors.meal ? "is-invalid" : ""
                      }`}
                      name="meal"
                      value={formData.meal}
                      onChange={handleChange}
                    >
                      <option value="">Select Meal</option>
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                      <option value="snacks">Snacks</option>
                    </select>
                    {errors.meal && (
                      <div className="invalid-feedback">{errors.meal}</div>
                    )}
                  </div>

                  <div className="mb-3 col-md-6">
                    <label className="form-label">Search Food</label>
                    <CreatableSelect
                      isClearable
                      options={suggestions}
                      value={formData.food}
                      onChange={handleFoodChange}
                      onCreateOption={handleFoodCreate}
                      placeholder="Enter or select food"
                      classNamePrefix="react-select"
                      styles={customSelectStyles} // Apply custom styles here
                      className={errors.food ? "is-invalid" : ""} // Conditional class
                    />
                    {errors.food && (
                      <div className="invalid-feedback">{errors.food}</div>
                    )}
                  </div>

                  <div className="mb-3 col-lg-12 text-center mt-3">
                    <button
                      className="btn custom-btn text-white w-50"
                      type="submit"
                    >
                      <i className="fa-thin fa-paper-plane"></i> &nbsp; Submit
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default DietMeal;
