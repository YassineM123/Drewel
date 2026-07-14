<div className="mb-3 w-100">
  <label className="form-label">Category</label>
  <input
    className="form-control"
    type="text"
    placeholder="Enter Category Here"
    name="category"
    value={formData.category}
    onChange={handleInputChange}
  />
  {errors.category && <small className="text-danger">{errors.category}</small>}
</div>;
