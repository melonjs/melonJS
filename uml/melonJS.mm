<map version="0.9.0">
<!-- To view this file, download free mind mapping software FreeMind from http://freemind.sourceforge.net -->
<node BACKGROUND_COLOR="#cccccc" COLOR="#669900" CREATED="1314802832364" ID="Freemind_Link_992966909" MODIFIED="1315207193101" STYLE="bubble" TEXT="MelonJS">
<font BOLD="true" NAME="SansSerif" SIZE="12"/>
<node BACKGROUND_COLOR="#cccccc" COLOR="#669900" CREATED="1314802832364" ID="ID_347861714" MODIFIED="1315214913541" POSITION="right" STYLE="bubble" TEXT="9.0.1">
<font BOLD="true" NAME="SansSerif" SIZE="12"/>
<node CREATED="1314957935908" ID="ID_450624124" MODIFIED="1314967898448" TEXT="Object">
<node CREATED="1314957576654" ID="ID_1599560234" MODIFIED="1314967898448" TEXT="Rect">
<node COLOR="#990000" CREATED="1314957720540" ID="ID_1163949243" MODIFIED="1315205705227" TEXT="SpriteObject">
<node COLOR="#990000" CREATED="1314957787444" ID="ID_1723256348" MODIFIED="1315205705227" TEXT="AnimatedSpriteObject">
<node COLOR="#990000" CREATED="1314957863238" ID="ID_1832080025" MODIFIED="1315205705227" TEXT="AnimationSheet">
<node COLOR="#990000" CREATED="1314958013093" ID="ID_1953289394" MODIFIED="1315205705227" TEXT="ObjectEntity">
<node COLOR="#990000" CREATED="1314965538118" ID="ID_215170623" MODIFIED="1315205705227" TEXT="CollectableEntity"/>
</node>
</node>
</node>
</node>
<node COLOR="#990000" CREATED="1314965691097" ID="ID_878883947" MODIFIED="1315205712023" TEXT="InvisibleEntity"/>
<node COLOR="#990000" CREATED="1314965861232" ID="ID_243449234" MODIFIED="1315205745366" TEXT="ViewportEntity"/>
</node>
<node CREATED="1314957971360" ID="ID_34036954" MODIFIED="1314967898448" TEXT="Font">
<node CREATED="1314957982641" ID="ID_744594961" MODIFIED="1314967898448" TEXT="BitmapFont"/>
</node>
<node CREATED="1314965644005" ID="ID_644059469" MODIFIED="1314967898448" TEXT="HUD_Item"/>
<node CREATED="1314965765142" ID="ID_1035042840" MODIFIED="1314967898448" TEXT="ScreenObject"/>
</node>
<node CREATED="1314957627762" ID="ID_1761204550" MODIFIED="1314967898448" TEXT="audio"/>
<node CREATED="1314965555258" ID="ID_97508418" MODIFIED="1314967898448" TEXT="debug"/>
<node CREATED="1314965578148" ID="ID_1858430391" MODIFIED="1314967898448" TEXT="entityPool"/>
<node CREATED="1314965601897" ID="ID_1090593079" MODIFIED="1314967898448" TEXT="game"/>
<node CREATED="1314965614553" ID="ID_487218857" MODIFIED="1314967898448" TEXT="gamestat"/>
<node CREATED="1314965675098" ID="ID_1411945780" MODIFIED="1314967898448" TEXT="input"/>
<node CREATED="1314965709081" ID="ID_1811442635" MODIFIED="1314967898448" TEXT="loader"/>
<node CREATED="1314965724940" ID="ID_539482053" MODIFIED="1314967898448" TEXT="ObjectSettings"/>
<node COLOR="#990000" CREATED="1314965739908" ID="ID_789143696" MODIFIED="1315205746632" TEXT="ParallaxBackgroundEntity"/>
<node CREATED="1314965779079" ID="ID_796848290" MODIFIED="1314967898448" TEXT="state"/>
<node CREATED="1314965798578" ID="ID_1955056634" MODIFIED="1314967898448" TEXT="sys"/>
<node CREATED="1314965813031" ID="ID_1335341637" MODIFIED="1314967898448" TEXT="timer"/>
<node CREATED="1314965821781" ID="ID_1381533426" MODIFIED="1314967898448" TEXT="Tween"/>
<node CREATED="1314965838046" ID="ID_517495155" MODIFIED="1314967898448" TEXT="Vector2D"/>
<node CREATED="1314965851576" ID="ID_986117524" MODIFIED="1314967898448" TEXT="video"/>
</node>
<node BACKGROUND_COLOR="#cccccc" COLOR="#669900" CREATED="1314802832364" ID="ID_712313108" MODIFIED="1316772101751" POSITION="left" STYLE="bubble" TEXT="Target">
<richcontent TYPE="NOTE"><html>
  <head>
    
  </head>
  <body>
    <p>
      Object -&gt; Rect -&gt; SpriteObject
    </p>
    <p>
      AnimationSheet (that would implement various texture/sprite format)
    </p>
    <p>
      ObjectEntity, that implements, SpriteObject &amp; AnimationSheet
    </p>
    <p>
      
    </p>
    <p>
      All entities should have a common ancestor (hence some renaming)
    </p>
    <p>
      About renaming (blue labels), I think more is needed.
    </p>
    <p>
      
    </p>
    <p>
      HUD_Item is a little lonely, maybe attache all hud items to a hub object.
    </p>
    <p>
      
    </p>
    <p>
      Should put a special color for singletons.
    </p>
    <p>
      
    </p>
    <p>
      On a side note, maybe several canvas may help (didn't check if it's already done):
    </p>
    <p>
      - 1 canvas for tilemap
    </p>
    <p>
      - 1 canvas for sprites
    </p>
    <p>
      - 1 canvas for particules
    </p>
    <p>
      
    </p>
    <p>
      game object, add constant{} container
    </p>
    <p>
      use it for directions so doWalk() like things can be clarified
    </p>
    <p>
      
    </p>
    <p>
      replace arrays with vectors (need to find a good js vector lib or make one without forgetting fast element removal (switch last item with removed one instead of moving aaaaalllll the other elems))
    </p>
  </body>
</html>
</richcontent>
<font BOLD="true" NAME="SansSerif" SIZE="12"/>
<node CREATED="1314957935908" ID="Freemind_Link_82160852" MODIFIED="1314967898448" TEXT="Object">
<node CREATED="1314957576654" ID="_" MODIFIED="1315207494810" TEXT="Rect">
<node COLOR="#0033ff" CREATED="1314965644005" ID="Freemind_Link_119902946" MODIFIED="1315224354380" TEXT="HUDItem">
<arrowlink DESTINATION="ID_158896139" ENDARROW="Default" ENDINCLINATION="406;0;" ID="Arrow_ID_1284975209" STARTARROW="None" STARTINCLINATION="327;0;"/>
</node>
<node COLOR="#0033ff" CREATED="1314965861232" ID="Freemind_Link_1564534956" MODIFIED="1315208344064" TEXT="Viewport"/>
<node COLOR="#0033ff" CREATED="1314965739908" ID="Freemind_Link_1988441239" MODIFIED="1315208357439" TEXT="ParallaxBackground"/>
<node CREATED="1314957720540" ID="Freemind_Link_769566364" MODIFIED="1315208754957" TEXT="SpriteObject">
<arrowlink DESTINATION="Freemind_Link_292683492" ENDARROW="Default" ENDINCLINATION="25;-12;" ID="Arrow_ID_190112926" STARTARROW="None" STARTINCLINATION="38;2;"/>
</node>
<node COLOR="#0033ff" CREATED="1314958013093" ID="Freemind_Link_292683492" MODIFIED="1315208754957" TEXT="EntityObject">
<node CREATED="1314965538118" ID="Freemind_Link_1144659780" MODIFIED="1315207873345" TEXT="CollectableEntity"/>
<node CREATED="1314965691097" ID="Freemind_Link_780249340" MODIFIED="1315207873704" TEXT="InvisibleEntity"/>
</node>
</node>
<node CREATED="1314957863238" ID="Freemind_Link_856464175" MODIFIED="1315207875048" TEXT="AnimationSheet">
<arrowlink DESTINATION="Freemind_Link_292683492" ENDARROW="Default" ENDINCLINATION="8;8;" ID="Arrow_ID_289231415" STARTARROW="None" STARTINCLINATION="36;0;"/>
</node>
<node COLOR="#0033ff" CREATED="1314965724940" ID="Freemind_Link_388649105" MODIFIED="1315208729802" TEXT="SettingsObject">
<arrowlink DESTINATION="Freemind_Link_292683492" ENDARROW="Default" ENDINCLINATION="34;18;" ID="Arrow_ID_777341563" STARTARROW="None" STARTINCLINATION="89;4;"/>
</node>
<node CREATED="1314957971360" ID="Freemind_Link_1370164220" MODIFIED="1314967898448" TEXT="Font">
<node CREATED="1314957982641" ID="Freemind_Link_1491101664" MODIFIED="1314967898448" TEXT="BitmapFont"/>
</node>
<node CREATED="1314965765142" ID="Freemind_Link_673922201" MODIFIED="1314967898448" TEXT="ScreenObject"/>
<node CREATED="1315207690773" ID="ID_158896139" MODIFIED="1315208193897" TEXT="HUDObject"/>
</node>
<node CREATED="1314965601897" ID="Freemind_Link_839477049" MODIFIED="1315208649867" TEXT="game">
<font NAME="SansSerif" SIZE="12"/>
<icon BUILTIN="gohome"/>
</node>
<node CREATED="1314957627762" ID="Freemind_Link_28299405" MODIFIED="1315208649867" TEXT="audio">
<arrowlink DESTINATION="Freemind_Link_839477049" ENDARROW="Default" ENDINCLINATION="31;0;" ID="Arrow_ID_1899489734" STARTARROW="None" STARTINCLINATION="31;0;"/>
</node>
<node CREATED="1314965555258" ID="Freemind_Link_1161356225" MODIFIED="1315208649867" TEXT="debug">
<arrowlink DESTINATION="Freemind_Link_839477049" ENDARROW="Default" ENDINCLINATION="49;0;" ID="Arrow_ID_1622110707" STARTARROW="None" STARTINCLINATION="49;0;"/>
</node>
<node CREATED="1314965614553" ID="Freemind_Link_1752239549" MODIFIED="1315208649867" TEXT="gamestat">
<arrowlink DESTINATION="Freemind_Link_839477049" ENDARROW="Default" ENDINCLINATION="69;0;" ID="Arrow_ID_557061005" STARTARROW="None" STARTINCLINATION="69;0;"/>
</node>
<node CREATED="1314965675098" ID="Freemind_Link_620408329" MODIFIED="1315208649867" TEXT="input">
<arrowlink DESTINATION="Freemind_Link_839477049" ENDARROW="Default" ENDINCLINATION="95;0;" ID="Arrow_ID_451444302" STARTARROW="None" STARTINCLINATION="95;0;"/>
</node>
<node CREATED="1314965709081" ID="Freemind_Link_534120620" MODIFIED="1315208649867" TEXT="loader">
<arrowlink DESTINATION="Freemind_Link_839477049" ENDARROW="Default" ENDINCLINATION="116;0;" ID="Arrow_ID_1950255362" STARTARROW="None" STARTINCLINATION="116;0;"/>
</node>
<node CREATED="1314965779079" ID="Freemind_Link_699190836" MODIFIED="1315208649867" TEXT="state">
<arrowlink DESTINATION="Freemind_Link_839477049" ENDARROW="Default" ENDINCLINATION="140;0;" ID="Arrow_ID_1668710216" STARTARROW="None" STARTINCLINATION="140;0;"/>
</node>
<node CREATED="1314965798578" ID="Freemind_Link_693363370" MODIFIED="1314967898448" TEXT="sys"/>
<node CREATED="1314965813031" ID="Freemind_Link_17713047" MODIFIED="1314967898448" TEXT="timer"/>
<node CREATED="1314965821781" ID="Freemind_Link_1638880855" MODIFIED="1314967898448" TEXT="Tween"/>
<node CREATED="1314965838046" ID="Freemind_Link_980145911" MODIFIED="1314967898448" TEXT="Vector2D"/>
<node CREATED="1314965851576" ID="Freemind_Link_1297758108" MODIFIED="1314967898448" TEXT="video"/>
<node CREATED="1314965578148" ID="Freemind_Link_1515295082" MODIFIED="1315208727239" TEXT="entityPool">
<arrowlink DESTINATION="Freemind_Link_839477049" ENDARROW="Default" ENDINCLINATION="276;0;" ID="Arrow_ID_889250711" STARTARROW="None" STARTINCLINATION="276;0;"/>
<arrowlink DESTINATION="Freemind_Link_292683492" ENDARROW="Default" ENDINCLINATION="349;117;" ID="Arrow_ID_1678527150" STARTARROW="None" STARTINCLINATION="451;0;"/>
</node>
</node>
</node>
</map>
