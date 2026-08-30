import { Field, FieldProps } from "formik";
import { Styled, Testable } from "./types";
import { Container } from "./Container";

interface TextFieldProps extends Styled, Testable {
  /** if `true`, the component is disabled */
  disabled?: boolean;
  label?: string;
  /** field name */
  name: string;
  placeholder?: string;
}

export const TextField = ({
  className,
  "data-testid": testId = "text-field",
  disabled,
  label,
  name,
  placeholder,
  ...containerProps
}: TextFieldProps) => (
  <Field name={name}>
    {({ field }: FieldProps) => (
      <div className={className} data-testid={`${testId}-field`}>
        <div className="h-[16px]">
          <p
            className="ml-4 font-secondary text-sm text-ghoul-400 line-height-0"
            data-testid={`${testId}-label`}
          >
            {label}
          </p>
        </div>
        <Container
          className="rounded-full py-0.5 px-4"
          data-testid={`${testId}-container`}
          {...containerProps}
        >
          <input
            className="font-secondary text-base text-ghoul-400 disabled:text-ghoul-900 active:text-ghoul-600 focus:text-ghoul-600 focus-visible:outline-none"
            data-testid={`${testId}-input`}
            disabled={disabled}
            type="text"
            placeholder={placeholder}
            {...field}
          />
        </Container>
      </div>
    )}
  </Field>
);
