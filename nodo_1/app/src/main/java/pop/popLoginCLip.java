package pop;

import android.content.Context;
import android.util.Patterns;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.google.android.material.textfield.TextInputEditText;
/*
import com.payclip.common.StatusCode;
import com.payclip.paymentui.client.ClipApi;
import com.payclip.paymentui.client.LoginListener;
 */

public class popLoginCLip {

    Context context;
    public void showPopupWindow(final View view) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.login_clip, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        this.context = popupView.getContext();
        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        TextInputEditText correo     = (TextInputEditText)popupView.findViewById(R.id.inputEditText_16_log_);
        TextInputEditText contraseña = (TextInputEditText)popupView.findViewById(R.id.inputEditText_2_log_);
        Button            butLog     = (Button) popupView.findViewById(R.id.but_log_clip);



        butLog.setOnClickListener(new View.OnClickListener() {
                                      @Override
                                      public void onClick(View view) {
                                          if(correo.length() > 0 && contraseña.length() > 0){
                                              if(isValidEmail(correo.getText().toString())){
                                               /*
                                                  ClipApi.login(correo.getText().toString(), contraseña.getText().toString(), new LoginListener() {
                                                      @Override
                                                      public void onLoginSuccess() {
                                                          toast("SESCION INICIADA");
                                                          JSONObject objectClip = new JSONObject();
                                                          try {
                                                              objectClip.put("correo", correo.getText().toString());
                                                              objectClip.put("pass", contraseña.getText().toString());
                                                          } catch (JSONException e) {
                                                              throw new RuntimeException(e);
                                                          }
                                                          generales.saveData_sharedPreferences(
                                                                  popupView.getContext(),
                                                                  popupView.getContext().getString(R.string.sesionClip),
                                                                  popupView.getContext().getString(R.string.sesionClip),
                                                                  objectClip.toString()
                                                                  );
                                                          toast("SESCION INICIADA");
                                                          popupWindow.dismiss();
                                                      }
                                                      @Override
                                                      public void onLoginFailed(@NotNull StatusCode.ClipError clipError) {
                                                          toast("PROBLEMA AL INICIAR SECION");
                                                      }
                                                  });
                                                */
                                              }
                                          }else {

                                          }
                                      }
                                  }
        );
    }
    public static boolean isValidEmail(String email) {
        return email != null && Patterns.EMAIL_ADDRESS.matcher(email).matches();
    }
    private void toast(String s){
        generales.toast(s, context);
    }

}
