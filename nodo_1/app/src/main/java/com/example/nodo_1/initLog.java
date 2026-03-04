package com.example.nodo_1;


import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;

public class initLog extends AppCompatActivity {
    private static final int RC_SIGN_IN = 9001; // Código de solicitud para el inicio de sesión
    private GoogleSignInClient mGoogleSignInClient;

    FirebaseAuth mAuth = FirebaseAuth.getInstance();
    FirebaseUser currentUser = mAuth.getCurrentUser();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        Intent intent = new Intent(this, principal.class);
        startActivity(intent);
        finish(); // Opcionalmente cierra la actividad actual

       /*
        if (currentUser != null) {
            // El usuario ha iniciado sesión
            // Puedes obtener información del usuario
            String name = currentUser.getDisplayName();
            String email = currentUser.getEmail();
            String uid = currentUser.getUid();
            // Actualiza la interfaz o realiza acciones necesarias
            Intent intent = new Intent(this, principal.class);
            startActivity(intent);
            finish(); // Opcionalmente cierra la actividad actual
        } else {

            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(getString(R.string.default_web_client_id)) // Asegúrate de que este ID esté en strings.xml
                    .requestEmail()
                    .build();

            // Inicializa el GoogleSignInClient
            mGoogleSignInClient = GoogleSignIn.getClient(this, gso);

            // Inicializa FirebaseAuth
            mAuth = FirebaseAuth.getInstance();

            signIn();

            // Opcional: verifica si el usuario ya ha iniciado sesión
            FirebaseUser currentUser = mAuth.getCurrentUser();
            updateUI(currentUser);
        }
        */

    }


    private void signIn() {
        Intent signInIntent = mGoogleSignInClient.getSignInIntent();
        startActivityForResult(signInIntent, RC_SIGN_IN);
    }

    // Maneja el resultado de la actividad de inicio de sesión
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // Resultado devuelto después de iniciar el Intent de inicio de sesión
        if (requestCode == RC_SIGN_IN) {
            // Tarea para obtener la cuenta de Google
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                // Inicio de sesión de Google exitoso, autenticación con Firebase
                GoogleSignInAccount account = task.getResult(ApiException.class);
                firebaseAuthWithGoogle(account.getIdToken());
            } catch (ApiException e) {
                // Si el inicio de sesión falla, muestra un mensaje al usuario
                Log.w("TAG", "Google sign in failed", e);
                updateUI(null);
            }
        }
    }

    // Autentica con Firebase usando el token de Google
    private void firebaseAuthWithGoogle(String idToken) {
        AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
        mAuth.signInWithCredential(credential)
                .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                    @Override
                    public void onComplete(@NonNull Task<AuthResult> task) {
                        if (task.isSuccessful()) {
                            // Inicio de sesión exitoso, actualiza la interfaz
                            FirebaseUser user = mAuth.getCurrentUser();
                            updateUI(user);
                        } else {
                            // Si el inicio de sesión falla, muestra un mensaje al usuario
                            Log.w("TAG", "signInWithCredential:failure", task.getException());
                            updateUI(null);
                        }
                    }
                });
    }

    // Actualiza la interfaz de usuario según el estado del inicio de sesión
    private void updateUI(FirebaseUser user) {
        if (user != null) {
            // El usuario ha iniciado sesión correctamente
            // Aquí puedes navegar a otra actividad o mostrar información del usuario
            Toast.makeText(this, "Inicio de sesión exitoso", Toast.LENGTH_SHORT).show();
            // Por ejemplo, inicia una nueva actividad
            Intent intent = new Intent(this, principal.class);
            startActivity(intent);
            finish(); // Opcionalmente cierra la actividad actual
        } else {
            // El inicio de sesión ha fallado
            Toast.makeText(this, "Error en el inicio de sesión", Toast.LENGTH_SHORT).show();
        }
    }

    // Opcional: Método para cerrar sesión
    private void signOut() {
        // Cierra sesión en Firebase
        mAuth.signOut();

        // Cierra sesión en Google
        mGoogleSignInClient.signOut().addOnCompleteListener(this,
                new OnCompleteListener<Void>() {
                    @Override
                    public void onComplete(@NonNull Task<Void> task) {
                        // Actualiza la interfaz después de cerrar sesión
                        updateUI(null);
                    }
                });
    }
}
