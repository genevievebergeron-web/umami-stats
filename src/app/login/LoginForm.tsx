import {
  Column,
  Form,
  FormButtons,
  FormField,
  FormSubmitButton,
  Heading,
  PasswordField,
  TextField,
} from '@umami/react-zen';
import { useRouter } from 'next/navigation';
import { useMessages, useUpdateQuery } from '@/components/hooks';
import { setClientAuthToken } from '@/lib/client';
import { setUser } from '@/store/app';

export function LoginForm() {
  const { t, labels, getErrorMessage } = useMessages();
  const router = useRouter();
  const { mutateAsync, error } = useUpdateQuery('/auth/login');

  const handleSubmit = async (data: any) => {
    await mutateAsync(data, {
      onSuccess: async (response: any) => {
        if (response.requiresTwoFactor) {
          sessionStorage.setItem('umami.partial-token', response.partialToken);
          router.push('/login/two-factor');
          return;
        }
        setClientAuthToken(response.token);
        setUser(response.user);
        router.push('/');
      },
    });
  };

  return (
    <Column className="gb-carte" data-theme="light" justifyContent="center" alignItems="center" gap="6">
      <span className="gb-etiquette">Statistiques</span>
      <Heading className="gb-marque">Geneviève.</Heading>
      <p className="gb-accroche">Bon retour. Les chiffres t’attendent.</p>
      <Form onSubmit={handleSubmit} error={getErrorMessage(error)} style={{ minWidth: 300 }}>
        <FormField
          label={t(labels.username)}
          data-test="input-username"
          name="username"
          rules={{ required: t(labels.required) }}
        >
          <TextField autoComplete="username" />
        </FormField>

        <FormField
          label={t(labels.password)}
          data-test="input-password"
          name="password"
          rules={{ required: t(labels.required) }}
        >
          <PasswordField autoComplete="current-password" />
        </FormField>
        <FormButtons>
          <FormSubmitButton
            data-test="button-submit"
            variant="primary"
            style={{ flex: 1 }}
            isDisabled={false}
          >
            {t(labels.login)}
          </FormSubmitButton>
        </FormButtons>
      </Form>
    </Column>
  );
}
