import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Home, MapPin, Users, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProperties } from '../contexts/PropertyContext';

const Properties = () => {
  const { user } = useAuth();
  const { properties, tenants, loading, error: loadError, refresh, createProperty, deleteProperty } = useProperties();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      setError('Name and address are required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const property = await createProperty(formData);
      setFormData({ name: '', address: '', description: '' });
      setShowForm(false);
      navigate(`/properties/${property.id}`);
    } catch (err) {
      console.error('Failed to create property:', err);
      setError(err.message || 'Failed to create property');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, propertyId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this property and all its tenants/bills?')) return;
    try {
      await deleteProperty(propertyId);
    } catch (err) {
      console.error('Failed to delete property:', err);
    }
  };

  const tenantCountFor = (propertyId) => tenants.filter((t) => t.property_id === propertyId).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Your Properties</h1>
          <p className="text-secondary-600 mt-1">{user?.email}</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Add Property</span>
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card mb-8"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-2">Property Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. 242 Property"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-2">Address</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  placeholder="e.g. 242 Warrigal Road"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-900 mb-2">Description (optional)</label>
              <input
                type="text"
                className="input-field"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            {error && <p className="text-danger-600 text-sm">{error}</p>}
            <div className="flex space-x-3">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Creating...' : 'Create Property'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {loading ? (
        <p className="text-secondary-600">Loading...</p>
      ) : loadError ? (
        <div className="card text-center py-16">
          <AlertCircle className="w-10 h-10 text-danger-600 mx-auto mb-3" />
          <p className="text-secondary-700 mb-4">Couldn't load your properties: {loadError}</p>
          <button onClick={refresh} className="btn-secondary">
            Try again
          </button>
        </div>
      ) : properties.length === 0 ? (
        <div className="card text-center py-16">
          <Home className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <p className="text-secondary-600">No properties yet. Add your first one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Link
              key={property.id}
              to={`/properties/${property.id}`}
              className="card hover:shadow-lg transition-shadow duration-300 relative group"
            >
              <button
                onClick={(e) => handleDelete(e, property.id)}
                className="absolute top-4 right-4 text-secondary-300 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Home className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-1">{property.name}</h3>
              <p className="text-secondary-600 text-sm flex items-center mb-4">
                <MapPin className="w-4 h-4 mr-1" />
                {property.address}
              </p>
              <p className="text-secondary-500 text-sm flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {tenantCountFor(property.id)} tenant{tenantCountFor(property.id) === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Properties;
