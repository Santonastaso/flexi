import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { SCHEMAS, showValidationError, showError } from '../utils';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Label,
} from './ui';

/**
 * Generic Form Component
 * Eliminates duplication across MachineForm, PhasesForm, BacklogForm, and OffTimeForm
 * Uses configuration-driven approach for form fields and validation
 */

/**
 * Field configuration object structure:
 * {
 *   name: string,           // Field name
 *   label: string,          // Display label
 *   type: string,           // Field type (text, number, select, textarea, etc.)
 *   required: boolean,       // Whether field is required
 *   placeholder?: string,    // Placeholder text
 *   options?: Array,         // For select fields
 *   rows?: number,          // For textarea fields
 *   disabled?: boolean,      // Whether field is disabled
 *   readOnly?: boolean,     // Whether field is read-only
 *   className?: string,     // Additional CSS classes
 *   validation?: Object,    // Custom validation rules
 *   conditional?: Function, // Function to determine if field should be shown
 * }
 */

/**
 * Section configuration object structure:
 * {
 *   title: string,          // Section title
 *   fields: Array,          // Array of field configurations
 *   gridCols?: string,      // CSS grid columns (default: "grid-cols-2 md:grid-cols-4 lg:grid-cols-8")
 * }
 */

const getValidationMessages = (errors) => {
  if (!errors || typeof errors !== 'object') return [];

  return Object.entries(errors).flatMap(([key, error]) => {
    if (!error || key === 'ref') return [];
    if (typeof error.message === 'string') return [error.message];
    return getValidationMessages(error);
  });
};

function GenericForm({ 
  config, 
  initialData = {}, 
  onSubmit, 
  onSuccess, 
  isEditMode = false,
  isLoading = false,
  customActions = null,
  customFieldRenderers = {},
  className = "p-1 bg-white rounded-lg shadow-sm border"
}) {
  // Create initial form data from config and provided data
  const initialFormData = useMemo(() => {
    const formData = {};
    
    config.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.name in initialData) {
          formData[field.name] = initialData[field.name];
        } else if (field.defaultValue !== undefined) {
          formData[field.name] = field.defaultValue;
        } else {
          formData[field.name] = '';
        }
      });
    });
    
    return formData;
  }, [config, initialData]);

  const validationSchema = config.validationSchema ? SCHEMAS[config.validationSchema] : null;
  const resolver = useMemo(
    () => validationSchema ? yupResolver(validationSchema) : undefined,
    [validationSchema]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    watch,
    setValue,
    getValues,
    reset
  } = useForm({
    defaultValues: initialFormData,
    resolver,
    reValidateMode: 'onChange'
  });

  // Handle form submission with validation
  const handleFormSubmit = async (data) => {
    // Call custom validation if provided
    if (config.customValidation) {
      const validation = config.customValidation(data);
      if (!validation.isValid) {
        showValidationError(Object.values(validation.errors));
        return;
      }
    }
    
    // Submit the form
    try {
      await onSubmit(data);
      if (onSuccess) onSuccess();
      reset(initialFormData);
    } catch (error) {
      const fallbackMessage = isEditMode ? config.editErrorMessage : config.addErrorMessage;
      showError(error.message || fallbackMessage || 'Form submission failed');
    }
  };

  const handleInvalidSubmit = (formErrors) => {
    showValidationError(getValidationMessages(formErrors));
  };

  // Render a single field based on its configuration
  const renderField = (field) => {
    const fieldValue = watch(field.name);
    const fieldError = errors[field.name]?.message;
    
    // Check conditional rendering
    if (field.conditional && !field.conditional(fieldValue, watch, getValues)) {
      return null;
    }

    // Check for custom field renderer first
    if (customFieldRenderers[field.type]) {
      return customFieldRenderers[field.type](field, {
        watch,
        control,
        setValue,
        getValues,
        register,
        isSubmitting,
        fieldError,
        fieldValue,
        errors
      });
    }

    const inputClassName = `${field.className || ''} ${fieldError ? 'border-red-500' : ''}`.trim();
    const baseInputProps = {
      id: field.name,
      placeholder: field.placeholder,
      disabled: field.disabled || isSubmitting,
      className: inputClassName,
      ...register(field.name, field.validation || {})
    };

    switch (field.type) {
      case 'select':
        return (
          <Select 
            onValueChange={(value) => setValue(field.name, value, { shouldDirty: true, shouldValidate: true })} 
            value={fieldValue || ''}
            disabled={field.disabled || isSubmitting}
          >
            <SelectTrigger className={fieldError ? 'border-red-500' : ''}>
              <SelectValue placeholder={field.placeholder || `Seleziona ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <textarea
            {...baseInputProps}
            rows={field.rows || 3}
            className={`w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-800 focus:border-transparent text-sm placeholder:text-muted-foreground ${inputClassName}`}
          />
        );

      case 'checkbox':
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id={`${field.name}_${option.value}`}
                  value={option.value} 
                  checked={fieldValue?.includes(option.value) || false}
                  onChange={(e) => {
                    const currentValues = getValues(field.name) || [];
                    if (e.target.checked) {
                      setValue(field.name, [...currentValues, option.value].sort(), { shouldDirty: true, shouldValidate: true });
                    } else {
                      setValue(field.name, currentValues.filter(v => v !== option.value), { shouldDirty: true, shouldValidate: true });
                    }
                  }}
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <Label htmlFor={`${field.name}_${option.value}`} className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'datetime-local':
        return <Input type="datetime-local" {...baseInputProps} />;

      case 'date':
        return <Input type="date" {...baseInputProps} />;

      case 'time':
        return <Input type="time" {...baseInputProps} />;

      case 'number':
        return <Input type="number" {...baseInputProps} />;

      case 'text':
      default:
        return <Input type="text" {...baseInputProps} />;
    }
  };

  // Render a section of fields
  const renderSection = (section) => {
    const visibleFields = section.fields.filter(field => 
      !field.conditional || field.conditional(watch(field.name), watch, getValues)
    );

    if (visibleFields.length === 0) return null;

    return (
      <div key={section.title} className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">
          {section.title}
        </h3>
        <div className={`grid gap-2 ${section.gridCols || 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8'}`}>
          {visibleFields.map(field => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>
                {field.label} {field.required && '*'}
              </Label>
              {renderField(field)}
              {field.helpText && (
                <p className="text-xs text-gray-500">{field.helpText}</p>
              )}
              {errors[field.name]?.message && (
                <p className="text-xs text-red-600">{errors[field.name].message}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render custom sections (like calculation results)
  const renderCustomSection = (sectionKey) => {
    if (customFieldRenderers[sectionKey]) {
      return customFieldRenderers[sectionKey]();
    }
    return null;
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} noValidate className="space-y-2">
        {config.sections.map(renderSection)}
        
        {/* Render custom sections */}
        {config.customFields && Object.keys(config.customFields).map(sectionKey => 
          <div key={sectionKey}>{renderCustomSection(sectionKey)}</div>
        )}
        
        {customActions && (
          <div className="space-y-2">
            {customActions}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            size="sm" 
            disabled={isLoading || isSubmitting}
          >
            {isLoading || isSubmitting
              ? (isEditMode ? config.editLoadingText : config.addLoadingText)
              : (isEditMode ? config.editButtonText : config.addButtonText)
            }
          </Button>
        </div>
      </form>
    </div>
  );
}

export default GenericForm;
